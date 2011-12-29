all:
	cat test/static/css/test-common.less test/static/css/test1-client.less | node_modules/less/bin/lessc - test/static/css/test1-client.css
	mkdir out
	cat src/gce-utils.js src/gce-managers.js src/gce-ui.js | node_modules/uglify-js/bin/uglifyjs > out/gce.min.js
	cp out/gce.min.js test/static/js/
