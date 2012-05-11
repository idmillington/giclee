(function($) {

    // ----------------------------------------------------------------------
    // This sample is fairly minimal, intended to show just basic document
    // creation and viewer setup.
    // ----------------------------------------------------------------------

    var document;
    var viewer;
    var initViewer = function() {
        document = giclee.document.Document.create([
            {type:"foo", pos:{x:100, y:100, o:0.1, s:1.2}},
            {type:"foo", pos:{x:300, y:200, o:0.3, s:0.9}}
        ]);

        viewer = giclee.viewer.Viewer.create($("#canvas"), document);
    };

    /**
     * We want the main viewer to resize with the window.
     */
    var initResizeManager = function() {
        var resize = giclee.managers.ResizeManager.create(
            $("#canvas"),
            $(window)
        );
        resize.events.register(
            "resize", function() { if (viewer !== undefined) viewer.draw(); }
        );
    };

    /**
     * Top level initialization.
     */
    var init = function() {
        initResizeManager();
        initViewer();
    };

    $(init);
})(jQuery);