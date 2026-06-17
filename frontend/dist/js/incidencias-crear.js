// Lógica del formulario de creación de incidencias

// Datos cascada Tipo → Subtipo
const subtipos = {
    infraestructura: ["Bache / Pavimento", "Alumbrado público", "Puentes / Vías", "Edificios públicos"],
    seguridad:       ["Robo / Asalto", "Vandalismo", "Zona de riesgo", "Violencia doméstica"],
    ambiental:       ["Basura / Desechos", "Contaminación del agua", "Deforestación", "Ruido excesivo"],
    servicios:       ["Falla de agua", "Falla eléctrica", "Falla de gas", "Internet / Telefonía"]
};

// ── Mapa Leaflet ─────────────────────────────────────────────────────────────
const mapaInicial = { lat: -0.9537, lng: -80.7286, zoom: 13 };
const mapa = L.map("mapa-incidencia").setView([mapaInicial.lat, mapaInicial.lng], mapaInicial.zoom);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(mapa);

let marcador = null;

function colocarMarcador(lat, lng) {
    if (marcador) {
        marcador.setLatLng([lat, lng]);
    } else {
        marcador = L.marker([lat, lng], { draggable: true }).addTo(mapa);
        marcador.on("dragend", function () {
            const pos = marcador.getLatLng();
            document.getElementById("latitud").value = pos.lat.toFixed(6);
            document.getElementById("longitud").value = pos.lng.toFixed(6);
        });
    }
    document.getElementById("latitud").value = lat.toFixed(6);
    document.getElementById("longitud").value = lng.toFixed(6);
    document.getElementById("error-mapa").classList.add("d-none");
}

mapa.on("click", function (e) {
    colocarMarcador(e.latlng.lat, e.latlng.lng);
});

document.getElementById("btn-geolocalizacion").addEventListener("click", function () {
    if (!navigator.geolocation) {
        alert("Su navegador no soporta geolocalización.");
        return;
    }
    const btn = this;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Detectando...';
    navigator.geolocation.getCurrentPosition(
        function (pos) {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            mapa.setView([lat, lng], 16);
            colocarMarcador(lat, lng);
            btn.disabled = false;
            btn.innerHTML = '<i data-feather="navigation" class="feather-icon me-1"></i> Usar mi ubicación actual';
            feather.replace();
        },
        function () {
            alert("No se pudo obtener la ubicación. Verifique los permisos del navegador.");
            btn.disabled = false;
            btn.innerHTML = '<i data-feather="navigation" class="feather-icon me-1"></i> Usar mi ubicación actual';
            feather.replace();
        }
    );
});

// ── Cascada Tipo → Subtipo ────────────────────────────────────────────────────
function poblarSelect(selectEl, opciones, placeholderTexto) {
    selectEl.innerHTML = `<option value="">${placeholderTexto}</option>`;
    opciones.forEach(function (op) {
        const opt = document.createElement("option");
        opt.value = op;
        opt.textContent = op;
        selectEl.appendChild(opt);
    });
    selectEl.disabled = false;
}

function resetSelect(selectEl, placeholderTexto) {
    selectEl.innerHTML = `<option value="">${placeholderTexto}</option>`;
    selectEl.disabled = true;
    selectEl.classList.remove("is-valid", "is-invalid");
}

document.getElementById("tipo").addEventListener("change", function () {
    const subtipoEl = document.getElementById("subtipo");
    const tipoVal = this.value;
    if (tipoVal && subtipos[tipoVal]) {
        poblarSelect(subtipoEl, subtipos[tipoVal], "-- Seleccione subtipo --");
    } else {
        resetSelect(subtipoEl, "-- Seleccione tipo primero --");
    }
});

// ── Contadores de caracteres ──────────────────────────────────────────────────
document.getElementById("titulo").addEventListener("input", function () {
    document.getElementById("contador-titulo").textContent = this.value.length + "/100";
});

document.getElementById("descripcion").addEventListener("input", function () {
    document.getElementById("contador-descripcion").textContent = this.value.length + "/500";
});

// ── Teléfono: solo números ────────────────────────────────────────────────────
document.getElementById("telefono").addEventListener("input", function () {
    this.value = this.value.replace(/\D/g, "").slice(0, 15);
});

// ── Envío del formulario ──────────────────────────────────────────────────────
document.getElementById("form-incidencia").addEventListener("submit", function (e) {
    e.preventDefault();

    const form = this;
    let valido = true;

    // Validar ubicación en mapa
    if (!document.getElementById("latitud").value) {
        document.getElementById("error-mapa").classList.remove("d-none");
        valido = false;
    }

    // Validar teléfono (opcional, pero si tiene valor debe ser ≥7 dígitos)
    const telEl = document.getElementById("telefono");
    if (telEl.value !== "" && telEl.value.length < 7) {
        telEl.classList.add("is-invalid");
        telEl.classList.remove("is-valid");
        valido = false;
    } else {
        telEl.classList.remove("is-invalid");
        if (telEl.value !== "") telEl.classList.add("is-valid");
    }

    // Validación nativa Bootstrap
    if (!form.checkValidity()) valido = false;
    form.classList.add("was-validated");

    if (!valido) return;

    // Estado loading
    document.getElementById("btn-texto").classList.add("d-none");
    document.getElementById("btn-loading").classList.remove("d-none");
    document.getElementById("btn-guardar").disabled = true;

    const payload = {
        titulo:      document.getElementById("titulo").value.trim(),
        descripcion: document.getElementById("descripcion").value.trim(),
        prioridad:   document.getElementById("prioridad").value,
        telefono:    document.getElementById("telefono").value || null,
        tipo:        document.getElementById("tipo").value,
        subtipo:     document.getElementById("subtipo").value,
        latitud:     parseFloat(document.getElementById("latitud").value),
        longitud:    parseFloat(document.getElementById("longitud").value),
        direccion:   document.getElementById("direccion").value.trim() || null
    };

    fetch("http://localhost:8000/api/incidencias", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(payload)
    })
        .then(function (res) {
            if (!res.ok) throw new Error("Error " + res.status);
            return res.json();
        })
        .then(function () {
            const toastEl = document.getElementById("toast-exito");
            new bootstrap.Toast(toastEl, { delay: 2000 }).show();
            feather.replace();
            setTimeout(function () {
                window.location.href = "incidencias-lista.html";
            }, 2000);
        })
        .catch(function (err) {
            console.error("Error al guardar incidencia:", err);
            alert("No se pudo guardar la incidencia. Intente nuevamente.");
        })
        .finally(function () {
            document.getElementById("btn-texto").classList.remove("d-none");
            document.getElementById("btn-loading").classList.add("d-none");
            document.getElementById("btn-guardar").disabled = false;
        });
});
