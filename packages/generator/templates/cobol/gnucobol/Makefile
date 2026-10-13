# Construire et lancer le programme COBOL avec GnuCOBOL.
#   make build  compile src/main/cobol/HELLO.CBL (cobc)
#   make start  compile puis exécute le programme

COBC ?= cobc
PROGRAM := HELLO

.PHONY: build start clean

build: bin/hello

bin/hello: src/main/cobol/$(PROGRAM).CBL
	mkdir -p bin
	$(COBC) -x -o $@ $<

start: build
	./bin/hello

clean:
	rm -rf bin

# Cibles optionnelles (tests) : présentes seulement si leur fichier existe.
-include *.mk
