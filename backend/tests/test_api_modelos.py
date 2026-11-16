"""Rotas de modelos IFC."""

from ferramentas.gerar_residencia_ifc import ARQUIVO_IFC


def test_abrir_exemplo_devolve_analise_completa(cliente):
    r = cliente.post("/api/v1/modelos/exemplo")

    assert r.status_code == 201
    corpo = r.json()
    assert corpo["origem"] == "exemplo"
    assert corpo["bim"]["arquivo"] == "residencia_exemplo.ifc"
    assert len(corpo["bim"]["ambientes"]) == 3
    assert len(corpo["termico"]["zonas"]) == 3
    assert all(c["ok"] for c in corpo["termico"]["checagens"])


def test_enviar_ifc_guarda_o_arquivo_e_permite_baixar_de_volta(cliente):
    conteudo = ARQUIVO_IFC.read_bytes()

    r = cliente.post("/api/v1/modelos", files={"arquivo": ("Minha Casa.ifc", conteudo)})

    assert r.status_code == 201
    modelo_id = r.json()["id"]
    assert r.json()["origem"] == "upload"
    assert r.json()["bim"]["arquivo"] == "Minha Casa.ifc"
    assert cliente.get(f"/api/v1/modelos/{modelo_id}").json()["id"] == modelo_id
    assert cliente.get(f"/api/v1/modelos/{modelo_id}/ifc").content == conteudo


def test_arquivo_que_nao_e_ifc_e_recusado_com_orientacao(cliente):
    por_extensao = cliente.post("/api/v1/modelos", files={"arquivo": ("casa.rvt", b"x")})
    por_conteudo = cliente.post("/api/v1/modelos", files={"arquivo": ("casa.ifc", b"PK\x03\x04")})

    assert por_extensao.status_code == 400 and ".ifc" in por_extensao.json()["detail"]
    assert por_conteudo.status_code == 400 and "IFC4" in por_conteudo.json()["detail"]


def test_ifc_corrompido_e_recusado_sem_derrubar_o_servidor(cliente):
    r = cliente.post(
        "/api/v1/modelos",
        files={"arquivo": ("casa.ifc", b"ISO-10303-21;\nHEADER;\nlixo sem fim")},
    )

    assert r.status_code == 400
    assert "Não foi possível ler" in r.json()["detail"]


def test_modelo_inexistente_responde_404(cliente):
    assert cliente.get("/api/v1/modelos/naoexiste").status_code == 404
    assert cliente.get("/api/v1/modelos/..%2F..%2Fsegredo").status_code == 404


def test_ajustes_comecam_vazios_e_sao_persistidos(cliente):
    modelo_id = cliente.post("/api/v1/modelos/exemplo").json()["id"]
    url = f"/api/v1/modelos/{modelo_id}/ajustes"
    ajustes = {
        "versao": 1,
        "materiais": {
            "alvenaria-de-tijolo-ceramico": {
                "condutividade": {"valor": 0.7, "unidade": "W/(m·K)", "origem": "manual"}
            }
        },
        "historico": [
            {"quando": "2026-11-16T10:00:00Z", "alvo": "Alvenaria", "campo": "condutividade",
             "de": 0.89, "para": 0.7}
        ],
    }  # fmt: skip

    assert cliente.get(url).json()["materiais"] == {}
    assert cliente.put(url, json=ajustes).status_code == 200
    salvo = cliente.get(url).json()

    assert salvo["materiais"]["alvenaria-de-tijolo-ceramico"]["condutividade"]["valor"] == 0.7
    assert salvo["materiais"]["alvenaria-de-tijolo-ceramico"]["condutividade"]["origem"] == "manual"
    assert salvo["historico"][0]["para"] == 0.7
    # O IFC original e a análise não mudam.
    bim = cliente.get(f"/api/v1/modelos/{modelo_id}").json()["bim"]
    tijolo = next(m for m in bim["materiais"] if m["id"] == "alvenaria-de-tijolo-ceramico")
    assert tijolo["propriedades"]["condutividade"]["valor"] == 0.89


def test_biblioteca_traz_fontes_e_estado_de_aprovacao(cliente):
    biblioteca = cliente.get("/api/v1/biblioteca").json()

    assert "ainda NÃO foram aprovados" in biblioteca["aviso"]
    for material in biblioteca["materiais"]:
        assert material["aprovado"] is False
        if material.get("condutividade") is not None:
            assert material["fonte"] in biblioteca["fontes"]
    for convencao in biblioteca["resistencias_superficiais"].values():
        assert convencao["aprovado"] is False and convencao["fonte"]


def test_dados_de_uso_dos_ambientes_sao_persistidos_com_os_ajustes(cliente):
    modelo = cliente.post("/api/v1/modelos/exemplo").json()
    ambiente = modelo["bim"]["ambientes"][0]["global_id"]
    url = f"/api/v1/modelos/{modelo['id']}/ajustes"
    uso = {"pessoas": {"valor": 2, "unidade": "pessoas", "origem": "manual"}}

    assert cliente.get(url).json()["operacao"] == {}
    assert cliente.put(url, json={"versao": 1, "operacao": {ambiente: uso}}).status_code == 200

    salvo = cliente.get(url).json()["operacao"][ambiente]["pessoas"]
    assert salvo["valor"] == 2 and salvo["origem"] == "manual"


def test_ajustes_gravados_antes_do_formulario_de_uso_continuam_abrindo(cliente):
    modelo_id = cliente.post("/api/v1/modelos/exemplo").json()["id"]
    url = f"/api/v1/modelos/{modelo_id}/ajustes"

    assert cliente.put(url, json={"versao": 1, "materiais": {}}).status_code == 200
    assert cliente.get(url).json()["operacao"] == {}
