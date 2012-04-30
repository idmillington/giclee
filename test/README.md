# Test Suite for GCE

The test suite runs using QUnit.

Run the `./run.sh` (or use another tool to serve the test directory)
and goto `http://localhost:8081` to see the test results. The run
script uses Python's built-in webserver, but there's no dependency on
Python, you could use Ruby's internal webserver instead:

        $ ruby -rwebrick -e'WEBrick::HTTPServer.new(:Port => 8081, :DocumentRoot => Dir.pwd).start'
