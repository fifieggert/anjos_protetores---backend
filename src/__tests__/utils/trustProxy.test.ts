import { describe, expect, it } from "vitest";
import { lerTrustProxy } from "../../utils/trustProxy";

describe("lerTrustProxy", () => {
    it.each([undefined, "", "  ", "0", "false", "FALSE"])("%j desliga o trust proxy (padrão em desenvolvimento)", (valor) => {
        expect(lerTrustProxy(valor)).toBe(false);
    });

    it.each([
        ["1", 1],
        [" 2 ", 2],
        ["10", 10],
    ])("%j confia em %i proxy(s) à frente", (valor, esperado) => {
        expect(lerTrustProxy(valor)).toBe(esperado);
    });

    it.each(["true", "loopback", "10.0.0.0/8", "-1", "1.5", "abc", "1e3", "100"])(
        "recusa %j (só número de proxies, de 0 a 99)",
        (valor) => {
            expect(() => lerTrustProxy(valor)).toThrow(/TRUST_PROXY/);
        },
    );
});
