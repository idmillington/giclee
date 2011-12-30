(function($) {

    // ----------------------------------------------------------------------
    // System Setup
    // ----------------------------------------------------------------------

    var _image_drop_manager;
    var _image_load_cache = {};
    var init_image_drop_manager = function() {
        _image_drop_manager = gce.managers.ImageDropManager.create(
            $canvas,
            function(img, fn) {
                // Check if it has already loaded.
                var crc = gce.utils.crc32(img.src.toString());
                if (_image_load_cache[crc]) {
                    console.warn("Already loaded image: "+fn);
                    return;
                }

                // Record that we've loaded this.
                _image_load_cache[crc] = true;

                // TODO: Do something with it.
            }
        );
    };

    var document;
    var viewer;
    var init_viewer = function() {
        document = gce.document.Document.create();
        viewer = gce.viewer.Viewer.create($("#canvas"), document);
    }

    var _resize_manager;
    var init_resize_manager = function() {
        _resize_manager = gce.managers.ResizeManager.create(
            $("#canvas"),
            $(window),
            function() { if (viewer !== undefined) viewer.draw(); }
        );
    };


    /**
     * Top level initialization.
     */
    var init = function() {
        init_resize_manager();
        init_viewer();

        // init_image_drop_manager();
    };

    $(init);
})(jQuery);