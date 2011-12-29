(function($) {
    // Import
    var ObjectBase = gce.utils.ObjectBase;
    var inherit = gce.utils.inherit;

    var aabb_create = gce.datatypes.aabb_create;

    var pos_create = gce.datatypes.pos_create;
    var pos_concat = gce.datatypes.pos_concat;
    var pos_invert = gce.datatypes.pos_invert;
    var pos_set_transform = gce.datatypes.pos_set_transform;

    // --------------------------------------------------------------------
    // Renderers are used to display object.
    // --------------------------------------------------------------------
    var Renderer = inherit(ObjectBase);

    /**
     * Creates a renderer for the given element. If any recursively
     * nested elements also need their own renderers, then the given
     * get_renderer function can be called to provide them.
     */
    Renderer.init = function(element, get_renderer) {
        this.element = element;
    };

    /**
     * Renders this object to the given context. This is normally not
     * overridden, since it provides top level support for things like
     * Position-Orientation-Scale and filters. Instead, override the
     * do_primitive_render function.
     */
    Renderer.render = function(c, pos_stack, global_bounds) {
        var pos = this.element.pos;
        pos = pos_concat(pos_stack[0], pos);

        // Add the transform on the stack.
        pos_stack.unshift(pos);
        c.save();
        pos_set_transform(pos, c);

        // Draw the object.
        this.do_primitive_render(c, pos_stack, global_bounds);

        // Remove the transform from the stack.
        c.restore();
        pos_stack.shift();

        // TODO: Handle filters.
    };

    /**
     * Override this function to do the actual rendering for this
     * object.
     */
    Renderer.do_primitive_render = function(c, pos_stack, global_bounds) {
        c.rect(-50, -50, 100, 100);
        c.fill();
    };

    // --------------------------------------------------------------------
    // The viewer displays a document on a canvas.
    // --------------------------------------------------------------------

    var Viewer = inherit(ObjectBase);

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

        this.document = document;

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
                renderer = RendererType.create(element, get_renderer);

                // Cache it.
                element["-renderer"] = renderer;
            }

            return renderer;
        };

        // Store the renderers and the function.
        this.renderers = renderers || {"$default":Renderer};
        this.get_renderer = get_renderer;

        this.draw();
    };

    /**
     * Performs a complete redraw of the canvas.
     */
    Viewer.draw = function() {
        var c = this.c;
        var w = this.$canvas.width(), h = this.$canvas.height();
        c.setTransform(1, 0, 0, 1, 0, 0);
        this.redraw(0, 0, w, h);
    }

    /**
     * Redraws the given part of the canvas.
     */
    Viewer.redraw = function(x, y, w, h) {
        var c = this.c;
        c.clearRect(x, y, w, h);

        var pos_stack = [pos_create()];
        var aabb = aabb_create(x, y, w, h);

        var content = this.document.content;
        for (var i = 0; i < content.length; i++) {
            var element = content[i];
            var renderer = this.get_renderer(element);

            // TODO: Check if it is in bounds.

            // Render it.
            renderer.render(c, pos_stack, aabb);
        }
    }

    // --------------------------------------------------------------------
    // API
    // --------------------------------------------------------------------

    if (window.gce === undefined) window.gce = {};
    window.gce.viewer = {
        Viewer: Viewer
    };

})(jQuery);