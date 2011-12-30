(function($) {
    // Import
    var ObjectBase = gce.utils.ObjectBase;
    var inherit = gce.utils.inherit;

    var pos_copy = gce.datatypes.pos_copy;

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
    // A drag manager allows dragging to affect a POS.
    // --------------------------------------------------------------------

    var DragManager = inherit(ObjectBase);

    DragManager.init = function() {
        this.rotate_scale_override = false;

        this.lock_position = false;
        this.lock_orientation = false;
        this.lock_scale = false;

        this.touch_lookup = {};
        this.active_touches = 0;
    };

    /**
     * Commits the drag data as if any dragging began at the current
     * state. This needs to be done when the kinds of dragging changes
     * (when we get more touches, for example, or when the
     * rotate-scale override changes). It shouldn't be done for every
     * change, since that way numerical errors are quickly compounded.
     */
    DragManager._commit = function() {
        // First update.
        this._update();

        // Set the initial position to be the current position.
        this.initial_pos = pos_copy(this.pos);

        // Now go through all touches and make the inital be the current.
        for (var id in this.touch_lookup) {
            var touch_data = this.touch_lookup[id];
            touch_data.initial.x = touch_data.current.x;
            touch_data.initial.y = touch_data.current.y;
        }
    };

    /**
     * Processes the current update data and sets the this.pos field
     * accordingly.
     */
    DragManager._update = function() {
        switch (this.active_touches) {
        case 0:
            break;

        case 1:
            if (this.rotate_scale_override) {
                // We're doing a rotate-scale update.
                this._update_orientation_scale();
            } else {
                // Update translation.
                this._update_position();
            }
            break;

        case 2:
            // We have two touches, allowing us to get all the data at once.
            this._update_position_orientation_scale();
            break;

        default:
            // We're over-specified, so ignore it for now.
            break;
        }
    };

    /**
     * Processes the single touch as a position change.
     */
    DragManager._update_position = function() {
        if (this.lock_position) return;

        for (var id in this.touch_lookup) {
            var touch_data = this.touch_lookup[id];
            var initial = this.initial_pos;
            this.pos.x = initial.x + touch_data.current.x-touch_data.initial.x;
            this.pos.y = initial.y + touch_data.current.y-touch_data.initial.y;

            // We should have only one entry, but to be safe exit
            // explicitly.
            break;
        }
    };

    /**
     * Processes the single touch as an orientation/scale change.
     */
    DragManager._update_orientation_scale = function() {
        if (this.lock_orientation && this.lock_scale) return;

        for (var id in this.touch_lookup) {
            var touch_data = this.touch_lookup[id];
            var origin = this.origin_xy;
            var initial = this.initial_pos;

            var dx = touch_data.current.x - origin.x;
            var dy = touch_data.current.y - origin.y;
            var ox = touch_data.initial.x - origin.x;
            var oy = touch_data.initial.y - origin.y;

            if (!this.lock_orientation) {
                var current_angle = Math.atan2(dy, dx);
                var initial_angle = Math.atan2(oy, ox);
                this.pos.o = initial.o + (current_angle - initial_angle);
            }

            if (!this.lock_scale      ) {
                var delta_scale = Math.sqrt(dx*dx+dy*dy)/Math.sqrt(ox*ox+oy*oy);
                this.pos.s = initial.s * delta_scale;
            }


            // We should have only one entry, but to be safe exit
            // explicitly.
            break;
        }
    };

    /**
     * Sets the current pos for the thing we're dragging. Normally
     * this is done before any touches are recognized.
     */
    DragManager.set_pos = function(pos, origin_xy, transform_origin) {
        this.initial_pos = pos_copy(pos);
        this.pos = pos_copy(pos);

        this.origin_xy = {x:origin_xy.x, y:origin_xy.y};
        this.transform_origin = transform_origin;

        this._commit();
    };

    /**
     * We can do rotation/scale with a single touch if this is
     * set. Normally on platforms without multitouch this is done with
     * another control (such as a modifier key).
     */
    DragManager.set_rotate_scale_override = function(bool) {
        if (this.rotate_scale_override != bool) {
            this._commit();
            this.rotate_scale_override = bool;
        }
    };

    /**
     * Sets the locks on what can be changed.
     */
    DragManager.set_locks = function(position, orientation, scale) {
        this._commit();
        this.lock_position = position;
        this.lock_orientation = orientation;
        this.lock_scale = scale;
    };

    /**
     * Notifies that the touch with the given id (a string, or
     * something that can be converted to a string uniquely) has begun
     * at the given x,y location.
     */
    DragManager.start_touch = function(id, xy) {
        // Create drag data to represent this drag.
        var touch_data = {
            initial: xy,
            current: xy
        };
        this.touch_lookup[id] = touch_data;
        this.active_touches++;
        this._commit();
    };

    /**
     * Notifies that the touch with the given id has moved to the
     * given location.
     */
    DragManager.move_touch = function(id, xy) {
        var touch_data = this.touch_lookup[id];
        touch_data.current = xy;
        this._update();
    };

    /**
     * Notifies that the touch with the given id has lifted from the
     * given location.
     */
    DragManager.end_touch = function(id, xy) {
        // Just end the touch, delegate to move to do any updates first.
        this.move_touch(id, xy);
        delete this.touch_lookup[id];
        this.active_touches--;
        this._commit();
    };

    // --------------------------------------------------------------------
    // API
    // --------------------------------------------------------------------

    if (window.gce === undefined) window.gce = {};
    window.gce.managers = {
        ImageManager: ImageManager,
        ImageDropManager: ImageDropManager,
        ResizeManager: ResizeManager,
        DragManager: DragManager
    }

})(jQuery);