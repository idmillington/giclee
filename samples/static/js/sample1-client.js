(function($) {

    // ----------------------------------------------------------------------
    // System Setup
    // ----------------------------------------------------------------------

    var _imageDropManager;
    var _imageLoadCache = {};
    var initImageDropManager = function() {
        _imageDropManager = gce.managers.ImageDropManager.create(
            $canvas,
            function(img, fn) {
                // Check if it has already loaded.
                var crc = gce.utils.crc32(img.src.toString());
                if (_imageLoadCache[crc]) {
                    console.warn("Already loaded image: "+fn);
                    return;
                }

                // Record that we've loaded this.
                _imageLoadCache[crc] = true;

                // TODO: Do something with it.
            }
        );
    };

    var document;
    var viewer;
    var initViewer = function() {
        document = gce.document.Document.create([
            {type:"foo", pos:{x:100, y:100, o:0.1, s:1.2}},
            {type:"foo", pos:{x:300, y:200, o:0.3, s:0.9}}
        ]);
        viewer = gce.viewer.Viewer.create($("#canvas"), document);
    }

    var _resizeManager;
    var initResizeManager = function() {
        _resizeManager = gce.managers.ResizeManager.create(
            $("#canvas"),
            $(window),
            function() { if (viewer !== undefined) viewer.draw(); }
        );
    };


    /**
     * Top level initialization.
     */
    var init = function() {
        initResizeManager();
        initViewer();

        // initImageDropManager();
    };

    $(init);
})(jQuery);