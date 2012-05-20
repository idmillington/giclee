(function($) {
    // Import
    var ObjectBase = giclee.utils.ObjectBase;

    var posConcat = giclee.datatypes.posConcat;
    var posInvert = giclee.datatypes.posInvert;
    var posTransform = giclee.datatypes.posTransform;
    var posSetTransform = giclee.datatypes.posSetTransform;

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
        if (!c.isPointInPath(150, 50)) {
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
        }
    })();

    // --------------------------------------------------------------------
    // A ModelFactory can produce Model objects from objects in the
    // document.
    // --------------------------------------------------------------------
    var ModelFactory = ObjectBase.extend();

    ModelFactory.init = function(DefaultModelClass, modelProperty) {
        this.DefaultModelClass = DefaultModelClass || Model;
        this.modelProperty = modelProperty || "-model";
        this.typeMapping = {};
    };

    /**
     * You can create individual model factories, but in most cases a
     * global one is fine, so this provides shared access to it. The
     * class is not a singleton, however, and separate instances can
     * be created if needed.
     */
    ModelFactory.getGlobal = function() {
        if (ModelFactory._sharedInstance === undefined) {
            ModelFactory._sharedInstance = ModelFactory.create(Model);
        }
        return ModelFactory._sharedInstance;
    };

    /**
     * Models are instantiated by their type name. This registers a
     * new model type for the given name.
     */
    ModelFactory.registerModelType = function(typeName, ModelClass) {
        this.typeMapping[typeName] = ModelClass;
    };

    /**
     * Returns a model for the given element, or null if the element
     * shouldn't have a model. Models are stored in a temporary
     * property property of the element ('-model' by default), so if
     * that property is defined, it will be returned without being
     * checked. If it is not defined, then it will be set by this
     * method.
     */
    ModelFactory.ensureAndGetModel = function(element) {
        if (element[this.modelProperty] === undefined) {
            var model = null;

            var type = element['type'];
            if (type !== undefined) {
                // See if we have a valid model class.
                var ModelClass = this.typeMapping[element['type']];
                if (ModelClass === undefined) {
                    console.warn("Type: '"+type+
                                 "' has no Model class, using default.");
                    ModelClass = this.DefaultModelClass;
                }

                // Create the model.
                model = ModelClass.create(element);

                // Recurse into the element.
                this.ensureModelsInChildren(element);
            }

            // Store the created model, or null.
            element[this.modelProperty] = model;
        }
        return element[this.modelProperty];
    };

    /**
     * Recursively ensures models in the children of the given
     * element. Children are any property, either other objects or
     * arrays.
     */
    ModelFactory.ensureModelsInChildren = function(element) {
        for (var key in element) {
            var value = element[key];
            if ($.isPlainObject(value)) {
                this.ensureAndGetModel(value);
            } else if ($.isArray(value)) {
                for (var i = 0; i < value.length; i++) {
                    this.ensureAndGetModel(value[i]);
                }
            }
        }
    };

    // --------------------------------------------------------------------
    // Models are attached to objects in the document and provide
    // Giclee-specific methods.
    // --------------------------------------------------------------------
    var Model = ObjectBase.extend();

    /**
     * Creates a model for the given element.
     */
    Model.init = function(element) {
        this.element = element;
    };

    /**
     * Renders this object to the given context. This is normally not
     * overridden, since it provides top level support for things like
     * in-bounds detection, Position-Orientation-Scale and
     * filters. Instead, override the renderLocalCoords function.
     */
    Model.renderGlobalCoords = function(c, posStack, globalBounds) {
        var pos = this.element.pos;
        pos = posConcat(posStack[0], pos);

        // TODO: Calculate the local bounds from the transform and
        // global bounds.
        var localBounds;

        // Set the transform.
        c.save();
        posStack.unshift(pos);
        posSetTransform(pos, c);

        // Draw the object.
        this.renderLocalCoords(c, posStack, localBounds);

        // Remove the transform.
        posStack.shift();
        c.restore();

        // TODO: Handle filters.
    };

    /**
     * Override this function to do the actual rendering for this
     * object.
     */
    Model.renderLocalCoords = function(c, posStack, localBounds) {
        // The base implemenation draws a placeholder-rectangle.
        c.fillRect(-50, -50, 100, 100);
    };

    /**
     * Returns true if the given global point is inside this
     * object. Objects can decide whether to be transparent to clicks,
     * or can use click areas that are different from their rendering
     * envelope. By default this method performs global to local
     * transform on the given point, then calls
     * isLocalPointInObject. In most cases, however, there are
     * better ways to calculate the same thing.
     */
    Model.isGlobalPointInObject = function(c, posStack, globalPoint) {
        var pos = this.element.pos;
        pos = posConcat(posStack[0], pos);

        // Calculate the local point.
        var globalToLocal = posInvert(pos);
        var localPoint = posTransform(globalToLocal, globalPoint);

        // Calculate the result.
        posStack.unshift(pos);
        var result = this.isLocalPointInObject(c, posStack, localPoint);
        posStack.shift();
        return result;
    };

    /**
     * Should return true if the given point (in object coordinates)
     * is in this object. This should be overridden, unless the global
     * version is overridden.
     */
    Model.isLocalPointInObject = function(c, posStack, localPoint) {
        var x = localPoint.x, y = localPoint.y;
        return x > -50 && x < 50 && y > -50 && y < 50;
    };

    // --------------------------------------------------------------------
    // API
    // --------------------------------------------------------------------

    if (window.giclee === undefined) window.giclee = {};
    window.giclee.model = {
        ModelFactory: ModelFactory,
        Model: Model
    };

})(jQuery);