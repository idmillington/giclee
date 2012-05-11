(function($) {
    // Import
    var ObjectBase = giclee.utils.ObjectBase;
    var posCopy = giclee.datatypes.posCopy;

    // --------------------------------------------------------------------
    // An event manager handles custom (i.e. non-DOM) events.
    // --------------------------------------------------------------------

    var EventManager = ObjectBase.create();

    /**
     * Event managers simply track listeners against event names, but
     * they can be arranged hierarchically, so that an event manager
     * will pass on its events to its parent. This is optional,
     * however and usually not needed.
     */
    EventManager.init = function(parent) {
        this.parent = parent;
        this.listeners = {};
    };

    /**
     * Register the given callback and optional this pointer to be
     * notified when events of the given name occur.
     */
    EventManager.register = function(eventName, callback, thisPointer) {
        // If we have one already, get rid of it.
        this.deregister(eventName, callback, thisPointer);

        var listeners = this.listeners[eventName];

        // Make sure we have a listener set.
        if (listeners === undefined) {
            listeners = this.listeners[eventName] = [];
        }

        // Add this record.
        listeners.push({callback:callback, context:thisPointer});
    };

    /**
     * Remove the previously registered callback.
     */
    EventManager.deregister = function(eventName, callback, thisPointer) {
        var listeners = this.listeners[eventName];
        if (listeners === undefined) return;
        for (var i = 0; i < listeners.length; i ++) {
            var record = listeners[i];
            if (record.callback===callback && record.context===thisPointer) {
                listeners.splice(i, 1);
                return;
            }
        }
    };

    /**
     * Notify all listeners that the event has happened.
     */
    EventManager.notify = function(eventName, data) {
        var listeners = this.listeners[eventName];

        // Notify the listeners.
        if (listeners !== undefined) {
            var event = {name:eventName, data:data};
            for (var i = 0; i < listeners.length; i++) {
                var record = listeners[i];
                record.callback.call(record.context, event);
            }
        }

        // Notify a parent.
        if (this.parent !== undefined) {
            this.parent.notify(eventName, data);
        }
    };

    // --------------------------------------------------------------------
    // Manages loading images in batches and caching the results.
    // --------------------------------------------------------------------

    var ImageManager = ObjectBase.extend();

    /**
     * ImageManagers represent a set of images that need to be
     * loaded. Each image manager can be given a set of images to
     * load, and will raise its 'loaded' event when all those images
     * are loaded. The images themselves are kept in a global cache
     * shared by all image managers.
     */
    ImageManager.init = function() {
        this.events = EventManager.create();

        // Keep track of what we need to find before we can raise the event.
        this.waitingFor = {};
    };

    /**
     * Call this method to ask the manager to load it. When all queued
     * images are loaded, the event will be disptched.
     */
    ImageManager.getImage = function(url) {
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
            this.waitingFor[url] = true;

            // Initialise the loading
            ImageManager._initLoad(url);
        } else if (record.loading) {
            // We're in the process of loading this, so just make sure
            // our interest is registered.
            if (!this.waitingFor[url]) {
                record.managers.push(this);
                this.waitingFor[url] = true;
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
    ImageManager._initLoad = function(url) {
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
                    manager._imageLoaded(url);
                }
                delete record.managers;
            };
            record.image.src = url;
        }
    };

    /**
     * Internal method that is called when the given url has been loaded.
     */
    ImageManager._imageLoaded = function(url) {
        delete this.waitingFor[url];

        // If we're the last one we're looking for, send the event.
        if ($.isEmptyObject(this.waitingFor)) {
            this.events.notify("loaded");
        }
    };

    // --------------------------------------------------------------------
    // An image drop manager allows images to be dropped on a container.
    // --------------------------------------------------------------------

    var ImageDropManager = ObjectBase.extend();

    /**
     * Manages drag and drop for images on the given container.
     */
    ImageDropManager.init = function($container) {
        this.$container = $container;
        this.events = EventManager.create();

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
     * Handles a drop event, extracts the images and throws the event.
     */
    ImageDropManager.drop = function(event) {
        // Make sure we stop if we crash.
        event.preventDefault();
        event.stopPropagation();

        // Find the transfer.
        var dataTransfer = event.originalEvent.dataTransfer;
        if ($.browser.webkit) dataTransfer.dropEffect = "copy";
        if (!dataTransfer || !dataTransfer.files ||
            !dataTransfer.files.length) return;

        // Extract the files in turn.
        var that = this;
        var extractFile = function(fileReader, file) {
            // When we've loaded the data, construct an image.
            fileReader.onload = function(event) {
                // Process the read data.
                var url = fileReader.result;
                var image = new Image();

                // Throws the event when the image is built
                // (should be pretty much instant).
                image.onload = function() {
                    var filename = file.name?file.name:file.fileName;
                    this.events.notify("image", filename);
                };

                // Start the transfer.
                image.src = fileReader.result;
            };
        };
        var files = dataTransfer.files;
        for (var i = 0; i < files.length; i++) {
            var fileReader = new FileReader();
            extractFile(fileReader, files[i]);
            fileReader.readAsDataURL(files[i]);
        }

        return false;
    };

    // --------------------------------------------------------------------
    // A resize notifier calls back when a UI element changes size.
    // --------------------------------------------------------------------

    var ResizeNotifier = ObjectBase.extend();

    ResizeNotifier.init = function($element) {
        this.events = EventManager.create();
        this.$element = $element;

        // Are we tracking the window?
        var isWindow = (
            $element.get !== undefined && $element.get(0) == window
        );

        // Set up the resizing code.
        this.lastSize = {w: null, h: null};
        if (isWindow) {
            this._initEventResize();
        } else {
            this._initPollingResize();
        }
        this._checkResize();
    };

    /**
     * This is called (and can be overridden) when the size changes,
     * before the events are dispatched.
     */
    ResizeNotifier._resized = function(w, h) {
    };

    /**
     * Called when we have reason to think the size may have changed.
     */
    ResizeNotifier._checkResize = function() {
        var w = this.$element.width();
        var h = this.$element.height();
        if (this.lastSize.w != w || this.lastSize.h != h) {
            this.lastSize.w = w;
            this.lastSize.h = h;
            this._resized(w, h);
            this.events.notify("resize", {width:w, height:h});
        }
    };

    /**
     * If we're tracking the window size, we can register with the
     * window resize event.
     */
    ResizeNotifier._initEventResize = function() {
        var that = this;
        this.$element.bind('resize', function() {
            that._checkResize();
        });
    };

    /**
     * The resize event only fires on the window, so this method polls
     * the container to see when it changes size.
     */
    ResizeNotifier._initPollingResize = function() {
        var that = this;
        setInterval(function() { that._checkResize(); }, 250);
    };


    // --------------------------------------------------------------------
    // A resize manager keeps a target the same size as a container.
    // --------------------------------------------------------------------

    var ResizeManager = ResizeNotifier.extend();

    /**
     * Manages keeping a DOM element resized to the size of a given
     * target. Sets both the absolute css width and height, and the
     * HTML attributes of the element.
     */
    ResizeManager.init = function($resize, $container) {
        this.$resize = $resize;
        ResizeNotifier.init.call(this, $container);
    };

    /**
     * This is called (and can be overridden) when the size changes,
     * before the event is dispatched.
     */
    ResizeManager._resized = function(w, h) {
        var wh = {width: w, height: h};
        this.$resize.width(w).height(h).attr(wh).css(wh);
    };


    // --------------------------------------------------------------------
    // A drag manager allows dragging to affect a POS.
    // --------------------------------------------------------------------

    var DragManager = ObjectBase.extend();

    DragManager.init = function() {
        this.rotateScaleOverride = false;

        this.lockPosition = false;
        this.lockOrientation = false;
        this.lockScale = false;

        this.touchLookup = {};
        this.activeTouches = 0;
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
        this.initialPos = posCopy(this.pos);

        // Now go through all touches and make the inital be the current.
        for (var id in this.touchLookup) {
            var touchData = this.touchLookup[id];
            touchData.initial.x = touchData.current.x;
            touchData.initial.y = touchData.current.y;
        }
    };

    /**
     * Processes the current update data and sets the this.pos field
     * accordingly.
     */
    DragManager._update = function() {
        switch (this.activeTouches) {
        case 0:
            break;

        case 1:
            if (this.rotateScaleOverride) {
                // We're doing a rotate-scale update.
                this._updateOrientationScale();
            } else {
                // Update translation.
                this._updatePosition();
            }
            break;

        case 2:
            // We have two touches, allowing us to get all the data at once.
            this._updatePositionOrientationScale();
            break;

        default:
            // We're over-specified, so ignore it for now.
            break;
        }
    };

    /**
     * Processes the single touch as a position change.
     */
    DragManager._updatePosition = function() {
        if (this.lockPosition) return;

        for (var id in this.touchLookup) {
            var touchData = this.touchLookup[id];
            var initial = this.initialPos;
            var deltaX = touchData.current.x-touchData.initial.x;
            var deltaY = touchData.current.y-touchData.initial.y;
            this.pos.x = initial.x + deltaX;
            this.pos.y = initial.y + deltaY;

            // We should have only one entry, but to be safe exit
            // explicitly.
            break;
        }
    };

    /**
     * Processes the single touch as an orientation/scale change.
     */
    DragManager._updateOrientationScale = function() {
        if (this.lockOrientation && this.lockScale) return;

        for (var id in this.touchLookup) {
            var touchData = this.touchLookup[id];

            var origin = this.osOrigin;
            var initial = this.initialPos;

            var deltaPos = giclee.datatypes.posFromPoints(
                origin, touchData.initial,
                origin, touchData.current,
                this.lockPosition, this.lockOrientation, this.lockScale
            );
            this.pos = giclee.datatypes.posConcat(deltaPos, this.initialPos);

            // We should have only one entry, but to be safe exit
            // explicitly.
            break;
        }
    };

    /**
     * Processes the double touch.
     */
    DragManager._updatePositionOrientationScale = function() {
        if (this.lockPosition && this.lockOrientation && this.lockScale) return;

        var touches = [];
        for (var id in this.touchLookup) {
            touches.push(this.touchLookup[id]);
        }

        // We should only be called with exactly two touches, so
        // assume our touches are the first pair.
        var deltaPos = giclee.datatypes.posFromPoints(
            touches[0].initial, touches[0].current,
            touches[1].initial, touches[1].current,
            this.lockPosition, this.lockOrientation, this.lockScale
        );
        this.pos = giclee.datatypes.posConcat(deltaPos, this.initialPos);
    };

    /**
     * Sets the current pos for the thing we're dragging. Normally
     * this is done before any touches are recognized.
     */
    DragManager.setPos = function(pos) {
        this.initialPos = posCopy(pos);
        this.pos = posCopy(pos);
        this._commit();
    };

    /**
     * Sets the origin for orientation/scale changes if the drag is
     * single touch. Orientation / scale changes require a second
     * point, and in single touch mode this is usually the object's
     * origin, but it could be some globally fixed location too.  This
     * should be called before any touches are reported. Its value is
     * ignored if single touch OS isn't used.
     */
    DragManager.setRotateScaleOrigin = function(origin, isGlobal) {
        this.osOrigin = {x:origin.x, y:origin.y};
        this.osOriginIsGlobal = isGlobal;
    };

    /**
     * We can do rotation/scale with a single touch if this is
     * set. Normally on platforms without multitouch this is done with
     * another control (such as a modifier key).
     */
    DragManager.setRotateScaleOverride = function(bool) {
        if (this.rotateScaleOverride != bool) {
            this._commit();
            this.rotateScaleOverride = bool;
        }
    };

    /**
     * Sets the locks on what can be changed.
     */
    DragManager.setLocks = function(position, orientation, scale) {
        this._commit();
        this.lockPosition = position;
        this.lockOrientation = orientation;
        this.lockScale = scale;
    };

    /**
     * Notifies that the touch with the given id (a string, or
     * something that can be converted to a string uniquely) has begun
     * at the given x,y location.
     */
    DragManager.startTouch = function(id, xy) {
        // Create drag data to represent this drag.
        var touchData = {
            initial: xy,
            current: xy
        };
        this.touchLookup[id] = touchData;
        this.activeTouches++;
        this._commit();
    };

    /**
     * Notifies that the touch with the given id has moved to the
     * given location.
     */
    DragManager.moveTouch = function(id, xy) {
        var touchData = this.touchLookup[id];
        touchData.current = xy;
        this._update();
    };

    /**
     * Notifies that the touch with the given id has lifted from the
     * given location.
     */
    DragManager.endTouch = function(id, xy) {
        // Just end the touch, delegate to move to do any updates first.
        this.moveTouch(id, xy);
        delete this.touchLookup[id];
        this.activeTouches--;
        this._commit();
    };

    // --------------------------------------------------------------------
    // API
    // --------------------------------------------------------------------

    if (window.giclee === undefined) window.giclee = {};
    window.giclee.managers = {
        EventManager: EventManager,
        ImageManager: ImageManager,
        ImageDropManager: ImageDropManager,
        ResizeNotifier: ResizeNotifier,
        ResizeManager: ResizeManager,
        DragManager: DragManager
    };

})(jQuery);