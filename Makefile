all: sample_css min_version debug_version downloads

.PHONY: all sample_css min_version debug_version clean downloads

# ----------------------------------------------------------------------------
# Sample CSS Generation from LESS files

SAMPLE_CSS_DIR = samples/static/css
COMMON_SAMPLE_CSS = $(SAMPLE_CSS_DIR)/sample-common.less
SAMPLE_LESS = $(wildcard $(SAMPLE_CSS_DIR)/sample*-client.less)
SAMPLE_CSS = $(patsubst %.less, %.css, $(SAMPLE_LESS))
LESSC = node_modules/less/bin/lessc

%.css: %.less
	cat $(COMMON_SAMPLE_CSS) $< | $(LESSC) - $@

sample_css: $(SAMPLE_CSS)

# ----------------------------------------------------------------------------
# Compiling of the main source code. NB: We have to explicitly state
# the javascript files in order here, since they have internal
# dependencies.

SRC_FILES = src/utils.js src/datatypes.js src/document.js src/managers.js \
	src/viewer.js src/ui.js

MIN_NAME = gce.min.js
DEBUG_NAME = gce.js
OUT_DIR = out
ADDITIONAL_DIRS = samples/static/js test/static/js
UGLIFY = node_modules/uglify-js/bin/uglifyjs


MIN_OUT = $(OUT_DIR)/$(MIN_NAME)
ADDITIONAL_MIN = $(addsuffix /$(MIN_NAME), $(ADDITIONAL_DIRS))

DEBUG_OUT = $(OUT_DIR)/$(DEBUG_NAME)
ADDITIONAL_DEBUG = $(addsuffix /$(DEBUG_NAME), $(ADDITIONAL_DIRS))

min_version: $(MIN_OUT) $(ADDITIONAL_MIN)
debug_version: $(DEBUG_OUT) $(ADDITIONAL_DEBUG)

$(OUT_DIR):
	mkdir -p $(OUT_DIR)

$(MIN_OUT): $(OUT_DIR) $(SRC_FILES)
	cat $(SRC_FILES) | $(UGLIFY) > $@

$(DEBUG_OUT): $(OUT_DIR) $(SRC_FILES)
	cat $(SRC_FILES) > $@

$(ADDITIONAL_MIN): $(MIN_OUT)
	cp $< $@

$(ADDITIONAL_DEBUG): $(DEBUG_OUT)
	cp $< $@


# ----------------------------------------------------------------------------
# Importing of jquery and qunit

JQUERY_NAME = jquery.min.js
JQUERY_SRC = http://code.jquery.com/$(JQUERY_NAME)

JQUERY_DIRS = samples/static/js test/static/js
JQUERY_FILES = $(addsuffix /$(JQUERY_NAME), $(JQUERY_DIRS))
JQUERY_TMP = /tmp/$(JQUERY_NAME)

downloads: $(JQUERY_FILES)

$(JQUERY_TMP):
	wget $(JQUERY_SRC) -O $(JQUERY_TMP)

$(JQUERY_FILES): $(JQUERY_TMP)
	cp $< $@



# ----------------------------------------------------------------------------
# Tidying up

clean:
	rm -f $(MIN_OUT) $(DEBUG_OUT) $(ADDITIONAL_MIN) $(ADDITIONAL_DEBUG)
	rm -f $(SAMPLE_CSS)
	rm -f $(JQUERY_FILES) $(JQUERY_TMP)
	rm -rf $(OUT_DIR)