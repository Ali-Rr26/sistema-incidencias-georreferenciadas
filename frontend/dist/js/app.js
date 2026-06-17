// Inicialización compartida — se carga en todas las páginas del sistema

$(function () {
    // Ocultar preloader
    $(".preloader").fadeOut(500);

    // Activar íconos Feather
    feather.replace();

    // FreeDash oculta .page-wrapper por defecto en su CSS; hay que mostrarlo
    $("body, .page-wrapper").trigger("resize");
    $(".page-wrapper").delay(20).show();

    // Sidebar toggle (móvil): abre/cierra el sidebar y cambia el ícono ≡ ↔ ✕
    $(".nav-toggler").on("click", function () {
        $("#main-wrapper").toggleClass("show-sidebar");
        $(".nav-toggler i").toggleClass("ti-menu");
    });

    // Cerrar sidebar al hacer clic en el overlay oscuro
    $("#sidebar-overlay").on("click", function () {
        $("#main-wrapper").removeClass("show-sidebar");
        $(".nav-toggler i").addClass("ti-menu");
    });
});
