/*
 * A model is the visual appearance of part of the document.
 */
/*jshint indent:2 */
(function($) {
  'use strict';

  // Import
  var ObjectBase = giclee.utils.ObjectBase;
  var objectConcat = giclee.utils.objectConcat;

  var posClone = giclee.datatypes.posClone;
  var posConcat = giclee.datatypes.posConcat;
  var posInvert = giclee.datatypes.posInvert;
  var posTransform = giclee.datatypes.posTransform;
  var posSetTransform = giclee.datatypes.posSetTransform;

  var AABB = giclee.datatypes.AABB;

  // --------------------------------------------------------------------
  // A ModelFactory can produce Model objects from objects in the
  // document.
  // --------------------------------------------------------------------
  var ModelFactory = ObjectBase.extend();

  ModelFactory.init = function(modelProperty) {
    this.modelProperty = modelProperty || '-model';
    this.typeMapping = {'group':GroupModel, '_default':Model};
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
   * Cloning a factory is useful if you want to have the same
   * mappings as another, plus some extras.
   */
  ModelFactory.clone = function() {
    var factory = ModelFactor.create(this.modelProperty);
    objectConcat(factory.typeMapping, this.typeMapping);
    return factory;
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
  ModelFactory.ensureAndGetModel = function(element, parent) {
    if (element[this.modelProperty] === undefined) {
      var model = null;

      if ($.isArray(element)) {
        model = this.typeMapping.group.create(this, element, parent);
      } else {
        var type = element.type;
        if (type !== undefined) {
          // See if we have a valid model class.
          var ModelClass = this.typeMapping[element.type];
          if (ModelClass === undefined) {
            console.warn(
              'Type: "' + type + '" has no Model class, using default.'
            );
            ModelClass = this.typeMapping._default;
          }

          // Create the model.
          model = ModelClass.create(this, element, parent);
        }
      }

      // Store the created model, or null.
      element[this.modelProperty] = model;
    }
    return element[this.modelProperty];
  };

  // --------------------------------------------------------------------
  // Models are attached to objects in the document and provide
  // Giclee-specific methods.
  // --------------------------------------------------------------------
  var Model = ObjectBase.extend();

  /**
   * Creates a model for the given element. Parent is used to pass
   * events along. The factory was the thing that created this
   * model, which we can use to recursively create any child models.
   */
  Model.init = function(factory, element, parent) {
    this.factory = factory;
    this.element = element;
    this.parent = parent;
  };

  /**
   * Renders this object to the given context. This is normally not
   * overridden, since it provides top level support for things like
   * in-bounds detection, and Position-Orientation-Scale. Instead,
   * override the renderLocalCoords function. Note that, because
   * this method sets the context's transform from the information
   * on the posStack (rather than incrementally transforming the
   * context's own transform matrix), it is safe to call this method
   * from a _renderLocalCoords call (for nested elements, say).
   */
  Model.render = function(c, posStack, globalBounds, options) {
    var boundsInGlobal = this.getBounds(posStack, options);

    // Draw bounds if needed.
    if (options.drawBounds) {
      this._drawBounds(c, boundsInGlobal);
    }

    // Draw the object itself.
    var pos = this._updateStack(posStack);
    if (boundsInGlobal.overlaps(globalBounds)) {
      // Set the transform.
      c.save();
      posSetTransform(pos, c);

      // Draw the object.
      this._renderLocalCoords(c, posStack, globalBounds, options);

      // Remove the transform.
      c.restore();
    }
    this._resetStack(posStack);
  };

  /**
   * Returns a bounding area in world coordinates for this object.
   */
  Model.getBounds = function(posStack, options) {
    var pos = this._updateStack(posStack);
    var localBounds = this._getLocalBounds(posStack, options);
    var globalBounds = localBounds.getTransformed(pos);
    this._resetStack(posStack);
    return globalBounds;
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
  Model.isPointInObject = function(c, posStack, globalPoint) {
    var pos = this._updateStack(posStack);

    // Calculate the local point.
    var globalToLocal = posInvert(pos);
    var localPoint = posTransform(globalToLocal, globalPoint);

    // Calculate the result.
    var result = this._isLocalPointInObject(c, posStack, localPoint);
    this.retoreStack(posStack);
    return result;
  };

  /**
   * For recursive elements, this should return the children. This
   * may be used by viewers to create more complex rendering and
   * caching strategies. If this element has no children, either a
   * falsy value or the empty list can be returned.
   */
  Model.getChildren = function() {
    return null;
  };

  /**
   * Helper method in debug mode to draw the given bounds in global
   * coords (normally this object's bounds).
   */
  Model._drawBounds = function(c, bounds) {
    c.save();
    c.strokeStyle = 'black';

    c.setTransform(1, 0, 0, 1, 0, 0);
    var xywh = bounds.getXYWH();
    c.strokeRect(xywh[0], xywh[1], xywh[2], xywh[3]);
    c.restore();
  };

  /**
   * Updates the pos stack adding this element's global pos to the
   * front of it. This can be undone with _resetStack.
   */
  Model._updateStack = function(posStack) {
    var pos;
    if (this.element.pos !== undefined) {
      pos = posConcat(posStack[0], this.element.pos);
    } else {
      pos = posClone(posStack[0]);
    }
    posStack.unshift(pos);
    return pos;
  };

  /**
   * Removes the head of the given pos stack.
   */
  Model._resetStack = function(posStack) {
    posStack.shift();
  };

  /**
   * Override this function to do the actual rendering for this
   * object. This must only be called from render().
   */
  Model._renderLocalCoords = function(c, posStack, globalBounds, options) {
    // The base implemenation draws a black placeholder-rectangle.
    c.fillStyle = 'black';
    c.fillRect(-50, -50, 100, 100);
  };

  /**
   * Override this function to return a local-space bounding object
   * for this element. This must only be called from getBounds().
   */
  Model._getLocalBounds = function(posStack, options) {
    // The base implementation's rectangle.
    return AABB.create(-50, -50, 50, 50);
  };

  /**
   * Should return true if the given point (in object coordinates)
   * is in this object. This should be overridden, unless the global
   * version is overridden. This must only be called from
   * isPointInObject().
   */
  Model._isLocalPointInObject = function(c, posStack, localPoint) {
    var x = localPoint.x;
    var y = localPoint.y;
    return x > -50 && x < 50 && y > -50 && y < 50;
  };

  // --------------------------------------------------------------------
  // A group model manages a group of children.
  // --------------------------------------------------------------------

  var GroupModel = Model.extend();

  /**
   * Returns the children to recurse into.
   */
  GroupModel.getChildren = function() {
    if ($.isArray(this.element)) {
      return this.element;
    } else {
      return this.element.children;
    }
  };

  /**
   * Returns the bounds for this object.
   */
  GroupModel.getBounds = function(posStack, options) {
    var children = this.getChildren();
    if (children.length === 0) {
      return null;
    } else {
      var pos = this._updateStack(posStack);
      var model = this.factory.ensureAndGetModel(children[0], this);
      var aabb = model.getBounds(posStack, options);

      for (var i = 1; i < children.length; i++) {
        var child = children[i];
        model = this.factory.ensureAndGetModel(child, this);
        aabb.inflate(model.getBounds(posStack, options));
      }

      this._resetStack(posStack);
      return aabb;
    }
  };

  /**
   * Checks if the given point is in one of this item's children.
   */
  GroupModel.isPointInObject = function(c, posStack, globalPoint) {
    var children = this.getChildren();
    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      var model = this.factory.ensureAndGetModel(child, this);
      if (model.isPointInObject(posStack, globalPoint)) {
        this._resetStack(posStack);
        return true;
      }
    }
    this._resetStack(posStack);
    return false;
  };

  /**
   * Renders the child objects.
   */
  GroupModel._renderLocalCoords = function(c, posStack, globalBounds, options) {
    var children = this.getChildren();
    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      var model = this.factory.ensureAndGetModel(child, this);
      model.render(c, posStack, globalBounds, options);
    }
  };

  // --------------------------------------------------------------------
  // API
  // --------------------------------------------------------------------

  if (window.giclee === undefined) {
    window.giclee = {};
  }
  window.giclee.model = {
    ModelFactory: ModelFactory,
    Model: Model
  };

}(jQuery));
