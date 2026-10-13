      *> Programme d'exemple : compose un message et l'affiche.
      *> Remplacez-le par votre programme ; gardez le paragraphe
      *> BUILD-GREETING tant que le test cobol-check s'y réfère.
       IDENTIFICATION DIVISION.
       PROGRAM-ID. HELLO.
       DATA DIVISION.
       WORKING-STORAGE SECTION.
       01  WS-NAME        PIC X(20) VALUE "COBOL".
       01  WS-GREETING    PIC X(40) VALUE SPACES.
       PROCEDURE DIVISION.
       MAIN-PARA.
           PERFORM BUILD-GREETING
           DISPLAY FUNCTION TRIM(WS-GREETING)
           GOBACK.
       BUILD-GREETING.
           MOVE SPACES TO WS-GREETING
           STRING "Hello, " DELIMITED BY SIZE
                  FUNCTION TRIM(WS-NAME) DELIMITED BY SIZE
                  "!" DELIMITED BY SIZE
               INTO WS-GREETING
           END-STRING.
