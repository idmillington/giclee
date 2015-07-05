(function($) {
  'use strict';

  var round = function(number) {
    return Math.round(number * 1000) * 0.001;
  };

  $(document).ready(function() {

    module('datatypes.js');
    var dt = giclee.datatypes;

    test('posFromPoints', function() {
      var tests = [
        [
          {x:1, y:1}, {x:2, y:1},  {x:4, y:1}, {x:5, y:1},
          {x:3, y:0, s:1, o:0}
        ],
        [
          {x:1, y:1}, {x:2, y:1},  {x:4, y:1}, {x:6, y:1},
          {x:2, y:-1, s:2, o:0}
        ],
        [
          {x:1, y:0}, {x:2, y:0},  {x:1, y:1}, {x:2, y:2},
          {x:0, y:0, s:round(Math.sqrt(2.0)), o:round(Math.PI * 0.25)}
        ],
        [
          {x:0, y:1}, {x:1, y:1},  {x:0, y:0}, {x:1, y:1},
          {x:1, y:-1, s:round(Math.sqrt(2.0)), o:round(Math.PI * 0.25)}
        ]
      ];
      expect(tests.length);

      for (var i = 0; i < tests.length; i++) {
        var test = tests[i];
        var pos = dt.posFromPoints(test[0], test[1], test[2], test[3]);
        pos.x = round(pos.x); pos.y = round(pos.y);
        pos.o = round(pos.o); pos.s = round(pos.s);
        deepEqual(pos, test[4]);
      }
    });

  });

}(jQuery));
