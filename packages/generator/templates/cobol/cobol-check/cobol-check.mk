# Tests unitaires COBOL avec cobol-check (Java requis).
#   make test   lance les tests de src/test/cobol/$(PROGRAM)

JAVA ?= java

# cobol-check est épinglé à un commit : la même version partout, en local et en CI.
COBOL_CHECK_VERSION := 0.2.19
COBOL_CHECK_COMMIT := 0921a094d68889946f5e94ad077fda99a92bf97f
COBOL_CHECK_URL := https://raw.githubusercontent.com/openmainframeproject/cobol-check/$(COBOL_CHECK_COMMIT)/build/distributions/cobol-check-$(COBOL_CHECK_VERSION).zip
COBOL_CHECK_JAR := .cobol-check/bin/cobol-check-$(COBOL_CHECK_VERSION).jar

.PHONY: test clean-test

test: $(COBOL_CHECK_JAR)
	chmod +x scripts/linux_gnucobol_run_tests
	rm -rf testruns
	$(JAVA) -jar $(COBOL_CHECK_JAR) -p $(PROGRAM)
	@grep -q "PASS:" testruns/testResults.txt
	@! grep -q "FAIL:" testruns/testResults.txt

$(COBOL_CHECK_JAR):
	mkdir -p .cobol-check
	curl -fsSL -o .cobol-check/cobol-check.zip $(COBOL_CHECK_URL)
	cd .cobol-check && unzip -q -o cobol-check.zip "bin/*"

clean-test:
	rm -rf testruns .cobol-check
