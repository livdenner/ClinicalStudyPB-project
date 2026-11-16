import importlib.util
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch


MODULO = Path(__file__).with_name("publicar.py")
SPEC = importlib.util.spec_from_file_location("publicar", MODULO)
publicar = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(publicar)


def git(pasta, *args):
    return subprocess.run(["git", *args], cwd=pasta, check=True, capture_output=True, text=True)


class PublicadorTest(unittest.TestCase):
    def test_registra_uma_vez_e_monta_indice(self):
        with tempfile.TemporaryDirectory() as temporario:
            raiz = Path(temporario)
            git(raiz, "init", "-q")
            git(raiz, "config", "user.name", "Teste")
            git(raiz, "config", "user.email", "teste@example.test")
            git(raiz, "config", "commit.gpgsign", "false")
            arquivo = raiz / "relatorio.md"
            arquivo.write_text("# Testes\n\n<!-- resumo: {\"total\":2,\"passou\":1,\"falhou\":1} -->\n", encoding="utf-8")
            arquivo_nomeado = raiz / "2026-11-16_10-30_abcdef1.md"
            arquivo.rename(arquivo_nomeado)
            destino = Path("docs/test-ci/development")
            self.assertTrue(publicar.registrar(raiz, destino, arquivo_nomeado))
            self.assertIn("| 2 | 1 | 1 |", (raiz / destino / "README.md").read_text(encoding="utf-8"))
            self.assertFalse(publicar.registrar(raiz, destino, arquivo_nomeado))

    def test_documentacao_isolada(self):
        with tempfile.TemporaryDirectory() as temporario:
            raiz = Path(temporario)
            git(raiz, "init", "-q")
            git(raiz, "config", "user.name", "Teste")
            git(raiz, "config", "user.email", "teste@example.test")
            git(raiz, "config", "commit.gpgsign", "false")
            (raiz / "README.md").write_text("base", encoding="utf-8")
            git(raiz, "add", "README.md")
            git(raiz, "commit", "-qm", "base")
            pasta = raiz / "docs/test-ci/main"
            pasta.mkdir(parents=True)
            (pasta / "2026-11-16_10-30_abcdef1.md").write_text("testes", encoding="utf-8")
            git(raiz, "add", "docs/test-ci/main")
            git(raiz, "commit", "-qm", "docs")
            sha = git(raiz, "rev-parse", "HEAD").stdout.strip()
            self.assertTrue(publicar.so_documentacao(raiz, sha))

    def test_push_preserva_relatorios_pendentes_e_atualiza_base(self):
        with tempfile.TemporaryDirectory() as temporario:
            raiz = Path(temporario)
            remoto, seed, work = (raiz / nome for nome in ("remote.git", "seed", "work"))
            subprocess.run(["git", "init", "--bare", "-q", str(remoto)], check=True)
            seed.mkdir()
            git(seed, "init", "-q")
            git(seed, "config", "user.name", "Teste")
            git(seed, "config", "user.email", "teste@example.test")
            git(seed, "config", "commit.gpgsign", "false")
            (seed / "README.md").write_text("base", encoding="utf-8")
            git(seed, "add", "README.md")
            git(seed, "commit", "-qm", "base")
            git(seed, "branch", "-M", "development")
            git(seed, "remote", "add", "origin", str(remoto))
            git(seed, "push", "-q", "origin", "development")
            git(seed, "checkout", "-qb", "ci-reports/development")
            pasta = seed / "docs/test-ci/development"
            pasta.mkdir(parents=True)
            (pasta / "2026-11-15_10-00_aaaaaaa.md").write_text("antigo", encoding="utf-8")
            git(seed, "add", "docs/test-ci/development")
            git(seed, "commit", "-qm", "relatório anterior")
            git(seed, "push", "-q", "origin", "ci-reports/development")
            git(seed, "checkout", "-q", "development")
            (seed / "README.md").write_text("base atualizada", encoding="utf-8")
            git(seed, "commit", "-qam", "código novo")
            sha = git(seed, "rev-parse", "HEAD").stdout.strip()
            git(seed, "push", "-q", "origin", "development")
            subprocess.run(["git", "clone", "-q", str(remoto), str(work)], check=True, capture_output=True)
            git(work, "config", "user.name", "Teste")
            git(work, "config", "user.email", "teste@example.test")
            git(work, "config", "commit.gpgsign", "false")
            relatorio = raiz / f"2026-11-16_10-30_{sha[:7]}.md"
            relatorio.write_text('<!-- resumo: {"total":1,"passou":1,"falhou":0} -->\n', encoding="utf-8")
            with patch.object(publicar, "api", return_value=[{"number": 1}]):
                publicar.publicar_push(work, "livdenner/ClinicalStudyPB-project", {"head_branch": "development", "head_sha": sha}, relatorio)
            self.assertEqual((work / "README.md").read_text(encoding="utf-8"), "base atualizada")
            self.assertTrue((work / "docs/test-ci/development/2026-11-15_10-00_aaaaaaa.md").exists())
            self.assertTrue((work / "docs/test-ci/development" / relatorio.name).exists())


if __name__ == "__main__":
    unittest.main()
