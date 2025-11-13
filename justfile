test-sixel:
    #!/bin/bash
    img2sixel --width 400 ./logo.png

test-sixel-web:
    #!/bin/bash
    echo "test"
    ./tty2web --port 8080 --term xterm --permit-write img2sixel --width 400 ./logo.png