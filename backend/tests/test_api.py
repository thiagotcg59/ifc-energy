"""Rotas HTTP de /api/v1, com o motor falso no lugar do EnergyPlus."""

from fastapi.testclient import TestClient

from app.main import criar_app
from tests.conftest import MotorFalso


def processar_fila(app) -> None:
    """Faz o trabalho que a fila em segundo plano faria."""
    while (registro := app.state.repositorio.proxima_na_fila()) is not None:
        app.state.servico_simulacao.processar(registro.id)


def test_saude_informa_o_energyplus(cliente):
    r = cliente.get("/api/v1/saude")

    assert r.status_code == 200
    corpo = r.json()
    assert corpo["estado"] == "ok"
    assert corpo["energyplus"]["encontrado"] is True
    assert corpo["energyplus"]["versao"] == "26.2.0"
    assert corpo["energyplus"]["versao_esperada"] == "26.2.0"


def test_saude_explica_o_que_fazer_sem_energyplus(configuracao, tmp_path):
    app = criar_app(configuracao, motor=MotorFalso(tmp_path, encontrado=False), iniciar_fila=False)
    with TestClient(app) as cliente:
        corpo = cliente.get("/api/v1/saude").json()

    assert corpo["energyplus"]["encontrado"] is False
    assert "IFC_ENERGY_ENERGYPLUS_DIR" in corpo["energyplus"]["mensagem"]


def test_criar_simulacao_responde_na_hora_e_fica_na_fila(cliente, motor):
    r = cliente.post("/api/v1/simulacoes/exemplo")

    assert r.status_code == 202
    assert r.json()["estado"] == "na_fila"
    assert motor.modos_executados == []  # nada rodou dentro da requisição


def test_simulacao_roda_dias_de_projeto_antes_da_anual(cliente, app, motor):
    sim_id = cliente.post("/api/v1/simulacoes/exemplo").json()["id"]

    processar_fila(app)

    assert motor.modos_executados == ["dias_de_projeto", "anual"]
    estado = cliente.get(f"/api/v1/simulacoes/{sim_id}").json()
    assert estado["estado"] == "concluida"


def test_resultados_depois_de_concluida(cliente, app):
    sim_id = cliente.post("/api/v1/simulacoes/exemplo").json()["id"]
    processar_fila(app)

    r = cliente.get(f"/api/v1/simulacoes/{sim_id}/resultados")

    assert r.status_code == 200
    assert r.json()["total_kwh"] == 200.0


def test_resultados_antes_de_concluir_respondem_409(cliente):
    sim_id = cliente.post("/api/v1/simulacoes/exemplo").json()["id"]

    r = cliente.get(f"/api/v1/simulacoes/{sim_id}/resultados")

    assert r.status_code == 409
    assert "ainda não terminou" in r.json()["detail"]


def test_falha_nos_dias_de_projeto_nao_roda_a_anual(configuracao, tmp_path):
    motor = MotorFalso(tmp_path, falhar_em="dias_de_projeto")
    app = criar_app(configuracao, motor=motor, iniciar_fila=False)
    with TestClient(app) as cliente:
        sim_id = cliente.post("/api/v1/simulacoes/exemplo").json()["id"]
        processar_fila(app)
        estado = cliente.get(f"/api/v1/simulacoes/{sim_id}").json()

    assert motor.modos_executados == ["dias_de_projeto"]
    assert estado["estado"] == "falhou"
    assert "dias de projeto" in estado["mensagem"]
    assert estado["detalhes"] == ["** Severe  ** Zona sem superfícies"]


def test_epjson_invalido_falha_antes_de_chamar_o_energyplus(configuracao, motor):
    configuracao.exemplo_epjson.write_text('{"ObjetoInventado": {}}', encoding="utf-8")
    app = criar_app(configuracao, motor=motor, iniciar_fila=False)
    with TestClient(app) as cliente:
        sim_id = cliente.post("/api/v1/simulacoes/exemplo").json()["id"]
        processar_fila(app)
        estado = cliente.get(f"/api/v1/simulacoes/{sim_id}").json()

    assert motor.modos_executados == []
    assert estado["estado"] == "falhou"
    assert any("ObjetoInventado" in d for d in estado["detalhes"])


def test_sem_energyplus_recusa_com_orientacao(configuracao, tmp_path):
    app = criar_app(configuracao, motor=MotorFalso(tmp_path, encontrado=False), iniciar_fila=False)
    with TestClient(app) as cliente:
        r = cliente.post("/api/v1/simulacoes/exemplo")

    assert r.status_code == 503
    assert "EnergyPlus" in r.json()["detail"]


def test_simulacao_inexistente_responde_404(cliente):
    r = cliente.get("/api/v1/simulacoes/nao-existe")

    assert r.status_code == 404
    assert "não encontrada" in r.json()["detail"]


def test_lista_traz_as_mais_recentes_primeiro(cliente):
    primeiro = cliente.post("/api/v1/simulacoes/exemplo").json()["id"]
    segundo = cliente.post("/api/v1/simulacoes/exemplo").json()["id"]

    ids = [s["id"] for s in cliente.get("/api/v1/simulacoes").json()]

    assert ids == [segundo, primeiro]


def test_simulacao_interrompida_e_marcada_ao_reiniciar(configuracao, motor):
    app = criar_app(configuracao, motor=motor, iniciar_fila=False)
    with TestClient(app) as cliente:
        sim_id = cliente.post("/api/v1/simulacoes/exemplo").json()["id"]
        app.state.repositorio.atualizar(sim_id, estado="anual")

    # "Reinicia" o servidor: a simulação que estava rodando não volta sozinha.
    app2 = criar_app(configuracao, motor=motor, iniciar_fila=False)
    with TestClient(app2) as cliente:
        estado = cliente.get(f"/api/v1/simulacoes/{sim_id}").json()

    assert estado["estado"] == "falhou"
    assert "interrompida" in estado["mensagem"]


def test_openapi_versionado_esta_atualizado(app):
    """O arquivo backend/openapi.json alimenta os tipos do front-end."""
    import json
    from pathlib import Path

    arquivo = Path(__file__).parents[1] / "openapi.json"
    assert json.loads(arquivo.read_text(encoding="utf-8")) == app.openapi(), (
        "Rode: uv run python -m app.exportar_openapi  (e depois, em frontend: npm run gerar-tipos)"
    )
