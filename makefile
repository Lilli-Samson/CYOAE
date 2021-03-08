TSC = tsc
TSC_FLAGS = --pretty -p
BROWSERIFY = NODE_PATH=. node_modules/.bin/browserify -p esmify
MINIFY = node_modules/uglify-es/bin/uglifyjs
ANTLR4 = node_modules/.bin/antlr4ts
ANTLR_FILES = cyoaeLexer.interp cyoaeLexer.ts cyoaeLexer.tokens cyoae.interp cyoaeParser.ts cyoaeListener.ts cyoae.tokens
RM = rm -f

all: release

release: main_release.js
	cp $< main.js

debug: main_debug.js
	cp $< main.js

main_release.js: main_debug.js
	$(MINIFY) $< -cm > $@

$(ANTLR_FILES) &: cyoae.g4 makefile
	$(ANTLR4) $<

CYOAE.js: CYOAE.ts $(ANTLR_FILES) tsconfig.json makefile
	$(TSC) $(TSC_FLAGS) .

main_debug.js: CYOAE.js $(ANTLR_FILES)
	$(BROWSERIFY) $< > $@

clean:
	$(RM) CYOAE.js main_release.js main_debug.js main.js $(ANTLR_FILES) cyoaeLexer.js cyoaeParser.js cyoaeListener.js