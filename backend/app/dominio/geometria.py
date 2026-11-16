"""Geometria de polígonos planos em 3D (funções puras, sem dependências)."""

import math

Vetor = tuple[float, float, float]
TOL = 1e-4  # tolerância em metros


def sub(a, b) -> Vetor:
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def escalar(a, b) -> float:
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def vetorial(a, b) -> Vetor:
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def norma(a) -> float:
    return math.sqrt(escalar(a, a))


def unitario(a) -> Vetor:
    n = norma(a)
    return (a[0] / n, a[1] / n, a[2] / n) if n else (0.0, 0.0, 0.0)


def vetor_area(vertices) -> Vetor:
    """Vetor cuja direção é a normal (regra da mão direita) e o tamanho é a área."""
    x = y = z = 0.0
    for i, p in enumerate(vertices):
        q = vertices[(i + 1) % len(vertices)]
        c = vetorial(p, q)
        x, y, z = x + c[0], y + c[1], z + c[2]
    return (x / 2, y / 2, z / 2)


def area(vertices) -> float:
    return norma(vetor_area(vertices))


def normal(vertices) -> Vetor:
    return unitario(vetor_area(vertices))


def azimute(n: Vetor, norte_graus: float = 0.0) -> float | None:
    """Ângulo da normal em relação ao norte, no sentido horário (0 = N, 90 = L).

    Devolve None para superfícies horizontais (não têm azimute).
    """
    if math.hypot(n[0], n[1]) < 1e-6:
        return None
    return round((math.degrees(math.atan2(n[0], n[1])) - norte_graus) % 360, 2) % 360


def inclinacao(n: Vetor) -> float:
    """Ângulo entre a normal e a vertical: 0 = para cima, 90 = parede, 180 = para baixo."""
    return round(math.degrees(math.acos(max(-1.0, min(1.0, unitario(n)[2])))), 2)


def rotulo_orientacao(az: float | None) -> str | None:
    if az is None:
        return None
    nomes = ["Norte", "Nordeste", "Leste", "Sudeste", "Sul", "Sudoeste", "Oeste", "Noroeste"]
    return nomes[round(az / 45) % 8]


def volume_fechado(poligonos) -> float:
    """Volume de um sólido fechado por polígonos com normais para fora."""
    return sum(escalar(p[0], vetor_area(p)) for p in poligonos) / 3


def _no_segmento(p, a, b) -> bool:
    """p está estritamente dentro do segmento a-b?"""
    ab, ap = sub(b, a), sub(p, a)
    if norma(vetorial(ab, ap)) > TOL * max(norma(ab), 1.0):
        return False
    t = escalar(ap, ab) / escalar(ab, ab)
    return t * norma(ab) > TOL and (1 - t) * norma(ab) > TOL


def arestas_abertas(poligonos) -> int:
    """Conta arestas que não casam com outra de sentido oposto (0 = sólido fechado).

    Arestas longas são divididas nos vértices de polígonos vizinhos que caem
    sobre elas, para que uma parede dividida em trechos case com o piso.
    """
    chave = lambda p: (round(p[0], 3), round(p[1], 3), round(p[2], 3))  # noqa: E731
    pontos = {chave(p): p for pol in poligonos for p in pol}
    saldo: dict[tuple, int] = {}
    for pol in poligonos:
        for i, a in enumerate(pol):
            b = pol[(i + 1) % len(pol)]
            meio = sorted(
                (p for p in pontos.values() if _no_segmento(p, a, b)),
                key=lambda p: escalar(sub(p, a), sub(b, a)),
            )
            cadeia = [a, *meio, b]
            for p, q in zip(cadeia, cadeia[1:], strict=False):
                kp, kq = chave(p), chave(q)
                if kp == kq:
                    continue
                par, sinal = ((kp, kq), 1) if kp < kq else ((kq, kp), -1)
                saldo[par] = saldo.get(par, 0) + sinal
    return sum(1 for v in saldo.values() if v != 0)


def contido(filho, pai) -> bool:
    """O polígono filho é coplanar e está inteiro dentro do polígono pai?"""
    n = normal(pai)
    if any(abs(escalar(sub(p, pai[0]), n)) > TOL for p in filho):
        return False
    u = unitario(sub(pai[1], pai[0]))
    v = vetorial(n, u)
    plano = lambda p: (escalar(sub(p, pai[0]), u), escalar(sub(p, pai[0]), v))  # noqa: E731
    contorno = [plano(p) for p in pai]
    return all(_dentro(plano(p), contorno) for p in filho)


def _dentro(p, contorno) -> bool:
    """Ponto dentro (ou na borda) de um polígono 2D — regra do número de cruzamentos."""
    x, y = p
    dentro = False
    for i, (x1, y1) in enumerate(contorno):
        x2, y2 = contorno[(i + 1) % len(contorno)]
        # Na borda conta como dentro.
        cruz = (x2 - x1) * (y - y1) - (y2 - y1) * (x - x1)
        if (
            abs(cruz) < TOL
            and min(x1, x2) - TOL <= x <= max(x1, x2) + TOL
            and min(y1, y2) - TOL <= y <= max(y1, y2) + TOL
        ):
            return True
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            dentro = not dentro
    return dentro
