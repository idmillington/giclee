(function($) {
    // Import
    var ObjectBase = gce.utils.ObjectBase;
    var inherit = gce.utils.inherit;

    // --------------------------------------------------------------------
    // Manages loading images in batches and cachine the results.
    // --------------------------------------------------------------------

    var ImageManager = inherit(ObjectBase);

    /**
     * ImageManagers represent a set of images that need to be
     * loaded. Each image manager can be given a set of images to
     * load, and will callback when all those images are loaded. The
     * images themselves are kept in a global cache shared by all image
     * managers.
     */
    ImageManager.init = function(callback, callback_data, callback_this) {
        this.callback = {
            callback: callback,
            data: callback_data,
            that: callback_this
        };

        // Keep track of what we need to find before we can call the
        // callback.
        this.waiting_for = {};
    };

    /**
     * Call this method to ask the manager to load it. When all queued
     * images are loaded, the manager's callback will be notified.
     */
    ImageManager.get_image = function(url) {
        var record = ImageManager._images[url];
        if (record === undefined) {
            // We haven't heard of this url before. Create a new record.
            record = {
                image: null,
                loading: false,
                managers: [this]
            };
            ImageManager._images[url] = record;

            // Register our interest in it.
            this.waiting_for[url] = true;

            // Initialise the loading
            ImageManager._init_load(url);
        } else if (record.loading) {
            // We're in the process of loading this, so just make sure
            // our interest is registered.
            if (!this.waiting_for[url]) {
                record.managers.push(this);
                this.waiting_for[url] = true;
            }
        } else {
            // We have loaded it already, so just return it.
            return record.image;
        }
        return null;
    };

    /**
     * Holds the global image cache.
     */
    ImageManager._images = {};

    /**
     * Internal method that begins loading a particular url.
     */
    ImageManager._init_load = function(url) {
        var record = ImageManager._images[url];
        if (record === undefined || !record.image) {

            // Start loading.
            record.loading = true;
            record.image = new Image();
            record.image.onload = function() {
                // We're done loading.
                record.loading = false;

                // Notify each manager that we're loaded.
                for (var i = 0; i < record.managers.length; i++) {
                    var manager = record.managers[i];
                    manager._image_loaded(url);
                }
                delete record.managers;
            };
            record.image.src = url;
        }
    };

    /**
     * Internal method that is called when the given url has been loaded.
     */
    ImageManager._image_loaded = function(url) {
        delete this.waiting_for[url];

        // If we're the last one we're looking for, call the callback.
        if ($.isEmptyObject(this.waiting_for)) {
            var cb = this.callback;
            if (cb.callback) {
                if (cb.that) {
                    cb.callback.apply(cb.that, cb.data);
                } else {
                    cb.callback(cb.data);
                }
            }
        }
    };

    // --------------------------------------------------------------------
    // An image drop manager allows images to be dropped on a container.
    // --------------------------------------------------------------------

    var ImageDropManager = inherit(ObjectBase);

    /**
     * Manages drag and drop for images on the given container.
     */
    ImageDropManager.init = function($container, drop_callback) {
        this.$container = $container;
        this.callback = drop_callback;

        // Register events
        var that = this;
        $container.on({
            dragover: function(event) { return that.dragover(event); },
            dragenter: function(event) { return that.dragenter(event); },
            drop: function(event) { return that.drop(event); }
        });
    };

    ImageDropManager.dragover = function(event) {
        return false;
    };

    ImageDropManager.dragenter = function(event) {
        return false;
    };

    /**
     * Handles a drop event, extracts the images and notifies the
     * callback.
     */
    ImageDropManager.drop = function(event) {
        // Make sure we stop if we crash.
        event.preventDefault();
        event.stopPropagation();

        // Find the transfer.
        var data_transfer = event.originalEvent.dataTransfer;
        if ($.browser.webkit) data_transfer.dropEffect = "copy";
        if (!data_transfer || !data_transfer.files ||
            !data_transfer.files.length) return;

        // Extract the files in turn.
        var that = this;
        var files = data_transfer.files;
        for (var i = 0; i < files.length; i++) {
            var file_reader = new FileReader();
            (function(file_reader, file) {
                // When we've loaded the data, construct an image.
                file_reader.onload = function(event) {
                    // Process the read data.
                    var url = file_reader.result;
                    var image = new Image();

                    // Notify the callback when the image is built
                    // (should be pretty much instant).
                    image.onload = function() {
                        var filename = file.name?file.name:file.fileName;
                        that.callback(image, filename);
                    };

                    // Start the transfer.
                    image.src = file_reader.result;
                };
            })(file_reader, files[i]);

            // Begin reading.
            file_reader.readAsDataURL(files[i]);
        }

        return false;
    };


    // --------------------------------------------------------------------
    // A resize manager keeps a target the same size as a container.
    // --------------------------------------------------------------------

    var ResizeManager = inherit(ObjectBase);

    /**
     * Manages keeping a DOM element resized to the size of a given
     * target. Sets both the absolute css width and height, and the
     * HTML attributes of the element.
     */
    ResizeManager.init = function($resize, $container, callback) {
        this.$resize = $resize;
        this.$container = $container;
        this.callback = callback;

        // Are we tracking the window?
        var isWindow = (
            $container.get !== undefined && $container.get(0) == window
        );

        // Set up the resizing code.
        this.lastSize = {w: null, h: null};
        if (isWindow) {
            this._init_event_resize();
        } else {
            this._init_polling_resize();
        }
        this._check_resize();
    };

    /**
     * Called when we have reason to think the size may have changed.
     */
    ResizeManager._check_resize = function() {
        var w = this.$container.width();
        var h = this.$container.height();
        if (this.lastSize.w != w || this.lastSize.h != h) {
            this.lastSize.w = w;
            this.lastSize.h = h;
            var wh = {width: w, height: h};
            this.$resize.width(w).height(h).attr(wh).css(wh);
            if (this.callback) this.callback(w, h);
        }
    };

    /**
     * If we're tracking the window size, we can register with the
     * window resize event.
     */
    ResizeManager._init_event_resize = function() {
        var that = this;
        this.$container.bind('resize', function() {
            that._check_resize()
        });
    };

    /**
     * The resize event only fires on the window, so this method polls
     * the container to see when it changes size.
     */
    ResizeManager._init_polling_resize = function() {
        var that = this;
        setInterval(function() { that._check_resize() }, 250);
    };

    // --------------------------------------------------------------------
    // API
    // --------------------------------------------------------------------

    if (window.gce === undefined) window.gce = {};
    window.gce.managers = {
        ImageManager: ImageManager,
        ImageDropManager: ImageDropManager,
        ResizeManager: ResizeManager
    }

})(jQuery);