// Inicialización compartida — se carga en todas las páginas del sistema

$(function () {
    // Ocultar preloader
    $(".preloader").fadeOut(500);

    // Activar íconos Feather
    feather.replace();

    // Sidebar toggle (móvil)
    $("#sidebar-toggler").on("click", function () {
        $("body").toggleClass("show-sidebar");
    });

    // Sidebar sub-menú: expandir / contraer al hacer clic en el módulo padre
    $(".sidebar-item.has-arrow > .sidebar-link").on("click", function () {
        const $li = $(this).closest(".sidebar-item");
        const $sub = $(this).next("ul");
        $sub.slideToggle(200);
        $li.toggleClass("active");
    });
});
