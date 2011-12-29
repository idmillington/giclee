(function($) {

    // ----------------------------------------------------------------------
    // System Setup
    // ----------------------------------------------------------------------

    var _image_drop_manager;
    var _image_load_cache = {};
    var init_image_drop_manager = function() {
        _image_drop_manager = ct.managers.ImageDropManager.create(
            $canvas,
            function(img, fn) {
                // Check if it has already loaded.
                var crc = ct.utils.crc32(img.src.toString());
                if (_image_load_cache[crc]) {
                    console.warn("Already loaded image: "+fn);
                    return;
                }

                // Record that we've loaded this.
                _image_load_cache[crc] = true;

                // TOdO: Do something with it.
            }
        );
    };

    var _resize_manager;
    var init_resize_manager = function() {
        _resize_manager = ct.managers.ResizeManager.create(
            $canvas,
            $(window),
            draw_cutout
        );
    };

    /**
     * Creates the context for drawing on the canvas.
     */
    var $canvas;
    var c;
    var init_canvas = function() {
        $canvas = $("#canvas");
        c = $canvas.get(0).getContext('2d');
    };

    /**
     * Top level initialization.
     */
    var init = function() {
        init_canvas();
        init_resize_manager();
        init_image_drop_manager();
    };

    $(init);
})(jQuery);