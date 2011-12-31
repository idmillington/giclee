(function($) {
    // Import
    var ObjectBase = gce.utils.ObjectBase;

    var aabb_create = gce.datatypes.aabb_create;

    var pos_create = gce.datatypes.pos_create;
    var pos_copy = gce.datatypes.pos_copy;
    var pos_concat = gce.datatypes.pos_concat;
    var pos_invert = gce.datatypes.pos_invert;
    var pos_transform = gce.datatypes.pos_transform;
    var pos_set_transform = gce.datatypes.pos_set_transform;

    var DragManager = gce.managers.DragManager;

    // ----------------------------------------------------------------------
    // Platform dependency shims
    // ----------------------------------------------------------------------

    /**
     * Test for and correct Mozilla's PointInPath bug (credit:
     * stackoverflow).
     */
    (function() {
        // Create a temporary canvas.
        var c = document.createElement("canvas").getContext("2d");
        c.translate(50, 0);
        c.moveTo(125, 50);
        c.arc(100, 50, 25, 0, 360, false);
        if (!c.isPointInPath(150, 50))
        {
            // Replace the method with a new wrapper.
            var proto = CanvasRenderingContext2D.prototype;
            var original = proto.isPointInPath;
            proto.isPointInPath = function(x, y) {
                this.save();
                this.setTransform(1,0, 0,1, 0,0);
                var result = original.call(this, x, y);
                this.restore();
                return result;
            };
        };
    })();

    // --------------------------------------------------------------------
    // Renderers are used to display object.
    // --------------------------------------------------------------------
    var Renderer = ObjectBase.extend();

    /**
     * Creates a renderer for the given element. If any recursively
     * nested elements also need their own renderers, then the given
     * get_renderer function can be called to provide them.
     */
    Renderer.init = function(parent, element, get_renderer) {
        this.parent = parent;
        this.element = element;
    };

    /**
     * Renders this object to the given context. This is normally not
     * overridden, since it provides top level support for things like
     * in-bounds detection, Position-Orientation-Scale and
     * filters. Instead, override the render_local_coords function.
     */
    Renderer.render_global_coords = function(c, pos_stack, global_bounds) {
        var pos = this.element.pos;
        pos = pos_concat(pos_stack[0], pos);

        // TODO: Calculate the local bounds from the transform and
        // global bounds.
        var local_bounds = undefined;

        // Set the transform.
        c.save();
        pos_stack.unshift(pos);
        pos_set_transform(pos, c);

        // Draw the object.
        this.render_local_coords(c, pos_stack, local_bounds);

        // Remove the transform.
        pos_stack.shift();
        c.restore();

        // TODO: Handle filters.
    };

    /**
     * Override this function to do the actual rendering for this
     * object.
     */
    Renderer.render_local_coords = function(c, pos_stack, local_bounds) {
        c.fillRect(-50, -50, 100, 100);
    };

    /**
     * Returns true if the given global point is inside this
     * object. Objects can decide whether to be transparent to clicks,
     * or can use click areas that are different from their rendering
     * envelope. By default this method performs global to local
     * transform on the given point, then calls
     * is_local_point_in_object. In most cases, however, there are
     * better ways to calculate the same thing.
     */
    Renderer.is_global_point_in_object = function(c, pos_stack, global_point) {
        var pos = this.element.pos;
        pos = pos_concat(pos_stack[0], pos);

        // Calculate the local point.
        var global_to_local = pos_invert(pos);
        var local_point = pos_transform(global_to_local, global_point);

        // Calculate the result.
        pos_stack.unshift(pos);
        var result = this.is_local_point_in_object(c, pos_stack, local_point);
        pos_stack.shift();
        return result;
    };

    /**
     * Should return true if the given point (in object coordinates)
     * is in this object. This should be overridden, unless the global
     * version is overridden.
     */
    Renderer.is_local_point_in_object = function(c, pos_stack, local_point) {
        var x = local_point.x, y = local_point.y;
        return x > -50 && x < 50 && y > -50 && y < 50;;
    };

    // --------------------------------------------------------------------
    // The viewer displays a document on a canvas.
    // --------------------------------------------------------------------

    var Viewer = ObjectBase.extend();

    /**
     * Creates a new viewer to connect the given canvas to the given
     * document.
     *
     * The given list of renderers are used to turn objects in the
     * document into a visual representation. They should be derived
     * from the Renderer object.
     */
    Viewer.init = function($canvas, document, renderers) {
        this.$canvas = $canvas
        this.canvas = $canvas.get(0);
        this.c = this.canvas.getContext("2d");

        this.pos = pos_create();
        this.document = document;

        this._init_renderers(renderers);
        this._init_events();

        this.draw();
    };

    /**
     * Initializes events.
     */
    Viewer._init_events = function() {
        var that = this;
        this.$canvas.mousedown(function(event) {
            var w = that.$canvas.width(), h = that.$canvas.height();

            var dm = DragManager.create();
            dm.set_pos(that.pos, {x:w*0.5, y:h*0.5}, false);
            dm.set_locks(false, true, false);
            dm.set_rotate_scale_override(event.shiftKey);
            dm.start_touch(1, {x:event.offsetX, y:event.offsetY});

            var move = function(event) {
                dm.set_rotate_scale_override(event.shiftKey);
                dm.move_touch(1, {x:event.offsetX, y:event.offsetY});

                that.pos = pos_copy(dm.pos);
                that.draw();
            };

            var up = function(event) {
                dm.end_touch(1, {x:event.offsetX, y:event.offsetY});

                that.$canvas.unbind('mousemove', move);
                that.$canvas.unbind('mouseup', up);
            };

            that.$canvas.bind('mousemove', move);
            that.$canvas.bind('mouseup', up);
        });
    };

    /**
     * Initializes the renderer lookup.
     */
    Viewer._init_renderers = function(renderers) {
        /*
         * Create a local function that can retrieve a valid renderer
         * for the given element.
         */
        var that = this;
        var get_renderer = function(element) {
            // Try to find a cached renderer.
            var renderer = element["-renderer"];
            if (renderer === undefined) {

                // Otherwise find the approprate type.
                var RendererType = that.renderers[element.type];
                if (RendererType === undefined) {
                    RendererType = that.renderers["$default"];
                }

                // Instantiate it.
                renderer = RendererType.create(that, element, get_renderer);

                // Cache it.
                element["-renderer"] = renderer;
            }

            return renderer;
        };

        // Store the renderers and the function.
        this.renderers = renderers || {"$default":Renderer};
        this.get_renderer = get_renderer;
    };

    /**
     * Returns the POS of the main view, which is based on the
     * internal POS field, and the dimensions of the canvas, such that
     * the position in that POS field appears at the center of the canvas.
     */
    Viewer.get_view_pos = function() {
        var pos = this.pos;
        var w = this.$canvas.width(), h = this.$canvas.height();
        return {x:w*0.5+pos.x, y:h*0.5+pos.y, o:pos.o, s:pos.s};
    };

    /**
     * Performs a complete redraw of the canvas.
     */
    Viewer.draw = function() {
        var c = this.c;
        var w = this.$canvas.width(), h = this.$canvas.height();

        c.setTransform(1, 0, 0, 1, 0, 0);
        this.redraw(0, 0, w, h);
    };

    /**
     * Redraws the given part of the canvas.
     */
    Viewer.redraw = function(x, y, w, h) {
        var c = this.c;
        c.clearRect(x, y, w, h);

        var pos_stack = [this.get_view_pos()];
        var aabb = aabb_create(x, y, w, h);

        var content = this.document.content;
        for (var i = 0; i < content.length; i++) {
            var element = content[i];
            var renderer = this.get_renderer(element);
            renderer.render_global_coords(c, pos_stack, aabb);
        }
    };

    /**
     * Returns the renderers of the objects at the given global
     * coordinates.
     */
    Viewer.get_renderers_at = function(xy) {
        var pos_stack = [this.get_view_pos()];
        var c = this.c;

        var result = [];
        var content = this.document.content;
        for (var i = 0; i < content.length; i++) {
            var element = content[i];
            var renderer = this.get_renderer(element);
            if (renderer.is_global_point_in_object(c, pos_stack, xy)) {
                result.push(renderer);
            };
        }
        return result;
    };

    // --------------------------------------------------------------------
    // API
    // --------------------------------------------------------------------

    if (window.gce === undefined) window.gce = {};
    window.gce.viewer = {
        Viewer: Viewer
    };

})(jQuery);