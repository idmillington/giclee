/* 
 * 
 */
/*jshint indent:2 */
(function($) {
  "use strict";

  /**
   * We use the console system for feedback (e.g. warnings when
   * types aren't defined). If there is no console available (on
   * firefox without firebug or in IE), then this crashes, so we
   * create a no-op shim using the console methods we use.
   */
  if (window.console === undefined) {
    window.console = {
      dir: function() {},
      log: function() {},
      warn: function() {},
      error: function() {}
    };
  }

  // ----------------------------------------------------------------------
  // Platform dependency shims
  // ----------------------------------------------------------------------

  /**
   * Animation can be synched to the platform refresh rate, but in a
   * platform-dependent way.
   */
  (function() {
    if (!window.requestAnimationFrame) {
      window.requestAnimationFrame = (
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        window.oRequestAnimationFrame ||
        window.msRequestAnimationFrame ||
        function(callback) {
          window.setTimeout(callback, 1000 / 60);
        }
      );
    }
  }());

  /**
   * Test for and correct Mozilla's PointInPath bug (see
   * https://bugzilla.mozilla.org/show_bug.cgi?id=405300 for bug and
   * solution).
   */
  (function() {
    // Create a temporary canvas.
    var c = document.createElement("canvas").getContext("2d");
    c.translate(50, 0);
    c.moveTo(125, 50);
    c.arc(100, 50, 25, 0, 360, false);
    if (!c.isPointInPath(150, 50)) {
      // Replace the method with a new wrapper that transforms
      // the context before doing the test.
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
  }());

  /**
   * Test and patch the jquery event handler to add offsetX and
   * offsetY on platforms that don't have it (see
   * http://bugs.jquery.com/ticket/8523 for bug and solution).
   */
  (function() {
    // Wrap the default filter with code to additionally set
    // offsetX/Y. NB: $.event.mouseHooks.filter is a
    // non-documented API for jQuery, so this may need to be
    // changed with new versions!
    var filter = $.event.mouseHooks.filter;
    $.event.mouseHooks.filter = function(event, original) {
      event = filter(event, original);
      if (typeof event.offsetX === "undefined" ||
        typeof event.offsetY === "undefined") {
        var targetOffset = $(event.target).offset();
        event.offsetX = event.pageX - targetOffset.left;
        event.offsetY = event.pageY - targetOffset.top;
      }
      return event;
    };
  }());

  /**
   * Make sure that mousewheel events have position data.
   */
  (function() {
    $.event.fixHooks.mousewheel = $.event.mouseHooks;
  }());

}(jQuery));