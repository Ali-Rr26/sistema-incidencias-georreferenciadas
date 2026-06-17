// Inicialización compartida — se carga en todas las páginas del sistema

$(function () {
    // Ocultar preloader
    $(".preloader").fadeOut(500);

    // Activar íconos Feather
    feather.replace();

    // FreeDash oculta .page-wrapper por defecto en su CSS; hay que mostrarlo
    $("body, .page-wrapper").trigger("resize");
    $(".page-wrapper").delay(20).show();

    // Sidebar toggle (móvil)
    $(".nav-toggler").on("click", function () {
        $("#main-wrapper").toggleClass("show-sidebar");
    });
});
