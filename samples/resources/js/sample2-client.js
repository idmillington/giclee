(function($) {

    // ----------------------------------------------------------------------
    // This sample adds an overview connected to the main viewer.
    // ----------------------------------------------------------------------

    var document;
    var viewer;
    var overview;

    /**
     * Top level initialization.
     */
    var init = function() {
        document = giclee.document.Document.create([
            {type:"foo", pos:{x:100, y:100, o:0.1, s:1.2}},
            {type:"foo", pos:{x:300, y:200, o:0.3, s:0.9}}
        ]);

        viewer = giclee.viewer.Viewer.create($("#viewer"), document);
        overview = giclee.viewer.Overview.create($("#overview"), viewer);
    };

    $(init);
})(jQuery);