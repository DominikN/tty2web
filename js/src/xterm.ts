import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { WebglAddon } from 'xterm-addon-webgl';
import { ImageAddon } from 'xterm-addon-image';
import { lib } from "libapps"

const terminal = new Terminal()
terminal.loadAddon(new FitAddon());
terminal.loadAddon(new WebLinksAddon());
terminal.loadAddon(new ImageAddon());

export class Xterm {
    elem: HTMLElement;
    term: Terminal;
    resizeListener: () => void;
    decoder: lib.UTF8Decoder;

    inputCallback: (input: string) => void;

    message: HTMLElement;
    messageTimeout: number;
    messageTimer: number;


    constructor(elem: HTMLElement) {
        this.elem = elem;
        this.term = new Terminal();
        const fitAddon = new FitAddon();
        this.term.loadAddon(fitAddon);
        const webLinksAddon = new WebLinksAddon();
        this.term.loadAddon(webLinksAddon);
        const imageAddon = new ImageAddon();
        this.term.loadAddon(imageAddon);

        if (elem.ownerDocument) {
            this.message = elem.ownerDocument.createElement("div") ;
        }
        this.message.className = "xterm-overlay";
        this.messageTimeout = 2000;


        this.resizeListener = () => {
            fitAddon.fit();
            this.term.scrollToBottom();
            this.showMessage(String(this.term.cols) + "x" + String(this.term.rows), this.messageTimeout);
        };

        this.term.open(elem);
	this.term.focus();
	this.resizeListener();
	window.addEventListener("resize", () => { this.resizeListener(); });

        this.decoder = new lib.UTF8Decoder()
    };

    info(): { columns: number, rows: number } {
        return { columns: this.term.cols, rows: this.term.rows };
    };

    output(data: string) {
        this.term.write(this.decoder.decode(data));
    };

    showMessage(message: string, timeout: number) {
        this.message.textContent = message;
        this.elem.appendChild(this.message);

        if (this.messageTimer) {
            clearTimeout(this.messageTimer);
        }
        if (timeout > 0) {
            this.messageTimer = window.setTimeout(() => {
                this.elem.removeChild(this.message);
            }, timeout);
        }
    };

    removeMessage(): void {
        if (this.message.parentNode == this.elem) {
            this.elem.removeChild(this.message);
        }
    }

    setWindowTitle(title: string) {
        document.title = title;
    };

    setPreferences(value: object) {
        Object.keys(value).forEach((key) => {
           if (key == "EnableWebGL" && key) {
               this.term.loadAddon(new WebglAddon());
           }
        });
    };

    // Feed bytes to the server as if the user had typed them, by handing them
    // to the same callback real keystrokes go through. Used by the touch key
    // bar (touchbar.js) for keys a phone keyboard does not have.
    //
    // Deliberately NOT xterm's own input path: 5.2's Terminal has no public
    // input(), paste() would mangle escape sequences, and _core.coreService
    // is private. The send callback is ours and is version-proof.
    input(data: string) {
        if (this.inputCallback) {
            this.inputCallback(data);
        }
    };

    onInput(callback: (input: string) => void) {
        this.inputCallback = callback;
        this.term.onData(data => {
            callback(data);
        });
    };

    onResize(callback: (columns: number, rows: number) => void) {
	this.term.onResize(data => {
        	callback(data.cols, data.rows);
	});
    };

    deactivate(): void {
        this.term.blur();
    }

    reset(): void {
        this.removeMessage();
        this.term.clear();
    }

    close(): void {
        window.removeEventListener("resize", this.resizeListener);
        this.term.dispose();
    }
}
