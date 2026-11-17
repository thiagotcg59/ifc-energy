"""A origem e o registro para desfazer devem sobreviver ao salvamento real."""


def test_estimativas_persistem_com_fonte_e_lote_sem_modificar_ifc(cliente):
    modelo = cliente.post("/api/v1/modelos/exemplo").json()
    modelo_id = modelo["id"]
    ambiente = modelo["bim"]["ambientes"][0]["global_id"]
    url = f"/api/v1/modelos/{modelo_id}/ajustes"
    ifc_antes = cliente.get(f"/api/v1/modelos/{modelo_id}/ifc").content
    valor = {
        "valor": 2,
        "unidade": "pessoas",
        "origem": "estimado",
        "fonte": "Perfil aprovado: Guarda et al. (2020), p. 8",
        "estimativa_id": "lote-1",
    }
    ajustes = {
        "operacao": {ambiente: {"pessoas": valor}},
        "estimativas": [{
            "id": "lote-1", "perfil": "centro-oeste-v1",
            "quando": "2026-11-16T20:00:00Z", "municipio": "Cuiabá/MT",
            "campos": [{
                "grupo": "operacao", "alvo_id": ambiente,
                "parametro": "pessoas", "anterior": None, "aplicado": valor,
            }],
        }],
    }  # fmt: skip

    assert cliente.put(url, json=ajustes).status_code == 200
    salvo = cliente.get(url).json()
    assert salvo["operacao"][ambiente]["pessoas"] == valor
    assert salvo["estimativas"] == ajustes["estimativas"]
    assert cliente.get(f"/api/v1/modelos/{modelo_id}/ifc").content == ifc_antes


def test_ajustes_antigos_abrem_sem_lotes_de_estimativas(cliente):
    modelo_id = cliente.post("/api/v1/modelos/exemplo").json()["id"]
    url = f"/api/v1/modelos/{modelo_id}/ajustes"
    assert cliente.put(url, json={"versao": 1, "materiais": {}}).status_code == 200
    assert cliente.get(url).json()["estimativas"] == []
