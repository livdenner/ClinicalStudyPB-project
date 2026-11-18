import importlib.util
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch


MODULO = Path(__file__).with_name("publicar.py")
SPEC = importlib.util.spec_from_file_location("publicar", MODULO)
publicar = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(publicar)

REPO = "livdenner/ClinicalStudyPB-project"
BOT = "clinicalstudypb-ci-reports[bot]"
RESUMO = '<!-- resumo: {"total":2,"passou":1,"falhou":1} -->\n'


def git(pasta, *args):
    return subprocess.run(["git", *args], cwd=pasta, check=True, capture_output=True, encoding="utf-8")


def configurar(pasta):
    git(pasta, "config", "user.name", "Teste")
    git(pasta, "config", "user.email", "teste@example.test")
    git(pasta, "config", "commit.gpgsign", "false")


def indice_falso(work, pasta_relativa):
    """Substitui o gerar.mjs (que só existe na main depois da integração da development)."""
    pasta = Path(work) / pasta_relativa
    nomes = sorted(p.name for p in pasta.glob("*.md") if publicar.ARQUIVO.fullmatch(p.name))
    (pasta / "README.md").write_text("\n".join(nomes), encoding="utf-8")


class Cenario:
    """Remoto bare com `development` e uma branch de PR, mais o clone em que o publicador trabalha."""

    def __init__(self, raiz):
        self.raiz = raiz
        self.remoto, self.seed, self.work = (raiz / nome for nome in ("remote.git", "seed", "work"))
        subprocess.run(["git", "init", "--bare", "-q", str(self.remoto)], check=True)
        self.seed.mkdir()
        git(self.seed, "init", "-q")
        configurar(self.seed)
        (self.seed / "README.md").write_text("base", encoding="utf-8")
        (self.seed / ".gitignore").write_text("docs/test-ci/pull-requests/\n", encoding="utf-8")
        git(self.seed, "add", ".")
        git(self.seed, "commit", "-qm", "base")
        git(self.seed, "branch", "-M", "development")
        git(self.seed, "remote", "add", "origin", str(self.remoto))
        git(self.seed, "push", "-q", "origin", "development")

    def commit(self, branch, arquivo, conteudo, mensagem="código"):
        git(self.seed, "checkout", "-q", "-B", branch, f"origin/{branch}" if self.existe(branch) else "origin/development")
        (self.seed / arquivo).parent.mkdir(parents=True, exist_ok=True)
        (self.seed / arquivo).write_text(conteudo, encoding="utf-8")
        git(self.seed, "add", "--force", arquivo)
        git(self.seed, "commit", "-qm", mensagem)
        git(self.seed, "push", "-q", "origin", f"HEAD:refs/heads/{branch}")
        git(self.seed, "fetch", "-q", "origin")
        return git(self.seed, "rev-parse", "HEAD").stdout.strip()

    def existe(self, branch):
        return subprocess.run(["git", "rev-parse", "--verify", "-q", f"origin/{branch}"], cwd=self.seed,
                              capture_output=True).returncode == 0

    def clonar(self):
        subprocess.run(["git", "clone", "-q", str(self.remoto), str(self.work)], check=True, capture_output=True)
        configurar(self.work)
        return self.work

    def ponta(self, branch):
        return git(self.remoto, "rev-parse", f"refs/heads/{branch}").stdout.strip()

    def arquivos(self, branch, pasta):
        saida = git(self.remoto, "ls-tree", "-r", "--name-only", branch, "--", pasta).stdout
        return [Path(nome).name for nome in saida.splitlines()]

    def relatorio(self, sha, nome="2026-11-16_10-30"):
        caminho = self.raiz / f"{nome}_{sha[:7]}.md"
        caminho.write_text(RESUMO, encoding="utf-8")
        return caminho


def api_falsa(cenario, pr):
    def responder(route):
        if route.startswith(f"repos/{REPO}/pulls/"):
            return pr
        if route.startswith(f"repos/{REPO}/commits/"):
            return {"commit": {"message": "feat: algo"}, "files": [{"filename": "README.md"}]}
        if route.startswith(f"repos/{REPO}/pulls?"):
            return [{"number": pr["number"]}]
        raise AssertionError(route)
    return responder


def pr_de(branch, sha, numero=7, repo=REPO, base="development"):
    return {"number": numero, "state": "open", "base": {"ref": base},
            "head": {"ref": branch, "sha": sha, "repo": {"full_name": repo} if repo else None}}


@patch.dict(os.environ, {"APP_LOGIN": BOT})
@patch.object(publicar, "indice", indice_falso)
class PublicarPrTest(unittest.TestCase):
    def setUp(self):
        self._temporario = tempfile.TemporaryDirectory()
        self.cenario = Cenario(Path(self._temporario.name))
        self.sha = self.cenario.commit("feat/x", "app.txt", "v1")
        self.work = self.cenario.clonar()
        self.arquivo = self.cenario.relatorio(self.sha)

    def tearDown(self):
        self._temporario.cleanup()

    def publicar(self, pr, run=None):
        run = run or {"actor": {"login": "pessoa"}, "pull_requests": [{"number": pr["number"]}], "head_branch": pr["head"]["ref"]}
        with patch.object(publicar, "api", side_effect=api_falsa(self.cenario, pr)):
            publicar.publicar_pr(self.work, REPO, run, self.arquivo)

    def test_versiona_na_branch_do_pr_mesmo_com_pasta_ignorada(self):
        self.publicar(pr_de("feat/x", self.sha))
        self.assertEqual(self.cenario.arquivos("feat/x", "docs/test-ci/pull-requests/7"), ["2026-11-16_10-30_" + self.sha[:7] + ".md", "README.md"])
        mensagem = git(self.cenario.remoto, "log", "-1", "--format=%s", "feat/x").stdout.strip()
        self.assertTrue(mensagem.startswith(publicar.MENSAGEM))

    def test_ignora_ci_disparada_pelo_bot(self):
        pr = pr_de("feat/x", self.sha)
        self.publicar(pr, {"actor": {"login": BOT}, "pull_requests": [{"number": 7}]})
        self.assertEqual(self.cenario.ponta("feat/x"), self.sha)

    def test_ignora_branch_do_bot(self):
        sha = self.cenario.commit("ci-reports/development", "docs/test-ci/development/a.md", "x")
        self.arquivo = self.cenario.relatorio(sha)
        self.publicar(pr_de("ci-reports/development", sha))
        self.assertEqual(self.cenario.ponta("ci-reports/development"), sha)

    def test_ignora_pr_de_fork(self):
        self.publicar(pr_de("feat/x", self.sha, repo="alguem/ClinicalStudyPB-project"))
        self.publicar(pr_de("feat/x", self.sha, repo=None))  # fork apagado
        self.assertEqual(self.cenario.ponta("feat/x"), self.sha)

    def test_ignora_relatorio_de_sha_desatualizado(self):
        novo = self.cenario.commit("feat/x", "app.txt", "v2")
        self.publicar(pr_de("feat/x", novo))
        self.assertEqual(self.cenario.ponta("feat/x"), novo)

    def test_desiste_sem_erro_quando_a_branch_anda_durante_a_publicacao(self):
        registrar = publicar.registrar

        def push_no_meio(*args):
            self.cenario.commit("feat/x", "app.txt", "v2")
            return registrar(*args)

        with patch.object(publicar, "registrar", side_effect=push_no_meio):
            self.publicar(pr_de("feat/x", self.sha))
        self.assertEqual(self.cenario.arquivos("feat/x", "docs/test-ci/pull-requests"), [])


@patch.dict(os.environ, {"APP_LOGIN": BOT})
@patch.object(publicar, "indice", indice_falso)
class PublicarPushTest(unittest.TestCase):
    def setUp(self):
        self._temporario = tempfile.TemporaryDirectory()
        self.cenario = Cenario(Path(self._temporario.name))

    def tearDown(self):
        self._temporario.cleanup()

    def test_push_preserva_relatorios_pendentes_e_atualiza_base(self):
        self.cenario.commit("ci-reports/development", "docs/test-ci/development/2026-11-15_10-00_aaaaaaa.md", "antigo")
        sha = self.cenario.commit("development", "README.md", "base atualizada")
        work = self.cenario.clonar()
        relatorio = self.cenario.relatorio(sha)
        with patch.object(publicar, "api", return_value=[{"number": 1}]):
            publicar.publicar_push(work, REPO, {"head_branch": "development", "head_sha": sha}, relatorio)
        self.assertEqual(git(self.cenario.remoto, "show", "ci-reports/development:README.md").stdout, "base atualizada")
        self.assertEqual(self.cenario.arquivos("ci-reports/development", "docs/test-ci/development"),
                         ["2026-11-15_10-00_aaaaaaa.md", relatorio.name, "README.md"])

    def test_refaz_a_publicacao_quando_outra_execucao_atualiza_a_branch_do_bot(self):
        sha = self.cenario.commit("development", "README.md", "v2")
        work = self.cenario.clonar()
        relatorio = self.cenario.relatorio(sha)
        montar = publicar.montar_bot
        chamadas = []

        def concorrente(*args):
            esperado = montar(*args)
            if not chamadas:  # Na primeira tentativa, outra execução publica antes deste push.
                self.cenario.commit("ci-reports/development", "docs/test-ci/development/2026-11-16_09-00_bbbbbbb.md", "outro")
            chamadas.append(esperado)
            return esperado

        with patch.object(publicar, "montar_bot", side_effect=concorrente), \
                patch.object(publicar, "api", return_value=[{"number": 1}]):
            publicar.publicar_push(work, REPO, {"head_branch": "development", "head_sha": sha}, relatorio, espera=lambda _: None)
        self.assertEqual(len(chamadas), 2)
        self.assertEqual(self.cenario.arquivos("ci-reports/development", "docs/test-ci/development"),
                         ["2026-11-16_09-00_bbbbbbb.md", relatorio.name, "README.md"])

    def test_abre_a_pr_do_bot_uma_vez_mesmo_com_disputa(self):
        respostas = iter([[], [{"number": 9}]])
        with patch.object(publicar, "api", side_effect=lambda _: next(respostas)), \
                patch.object(publicar, "comando", return_value=subprocess.CompletedProcess([], 1, "", "already exists")):
            publicar.abrir_pr(REPO, "development", "ci-reports/development")

    def test_documentacao_isolada(self):
        sha = self.cenario.commit("development", "docs/test-ci/main/2026-11-16_10-30_abcdef1.md", "testes")
        work = self.cenario.clonar()
        self.assertTrue(publicar.so_documentacao(work, sha))
        self.assertFalse(publicar.so_documentacao(work, git(work, "rev-parse", f"{sha}^1").stdout.strip()))


@unittest.skipUnless(publicar.GERADOR.is_file(), "gerar.mjs chega à main com a integração da development")
class IndiceTest(unittest.TestCase):
    def test_indice_usa_o_formato_do_gerador(self):
        with tempfile.TemporaryDirectory() as temporario:
            raiz = Path(temporario)
            pasta = Path("docs/test-ci/pull-requests/7")
            (raiz / pasta).mkdir(parents=True)
            (raiz / pasta / "2026-11-16_10-30_abcdef1.md").write_text(RESUMO, encoding="utf-8")
            publicar.indice(raiz, pasta)
            texto = (raiz / pasta / "README.md").read_text(encoding="utf-8")
            self.assertIn("| Integração | Ambiente |", texto)
            self.assertIn("[Voltar aos históricos](../../README.md)", texto)


if __name__ == "__main__":
    unittest.main()
