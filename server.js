import express from 'express';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;

// Arrays em memória (sem banco de dados)
const usuarios = [];

const alunos = [
  { id: 1, nome: 'Ana Souza', ra: 'RA001', nota1: 8.5, nota2: 7.5 },
  { id: 2, nome: 'Bruno Lima', ra: 'RA002', nota1: 5.0, nota2: 6.0 },
  { id: 3, nome: 'Carla Mendes', ra: 'RA003', nota1: 4.0, nota2: 5.5 }
];

// Middleware de autenticação JWT
function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: 'Token de acesso não fornecido!' });
  }

  const partes = authHeader.split(' ');
  if (partes.length !== 2 || partes[0] !== 'Bearer') {
    return res.status(401).json({ message: 'Formato do token inválido! Use Bearer <token>.' });
  }

  const token = partes[1];

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: 'Token inválido ou expirado!' });
    }

    req.user = decoded;
    next();
  });
}

// Rota de cadastro de usuário
app.post('/register', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Usuário e senha são obrigatórios!' });
  }

  const usuarioExistente = usuarios.find((u) => u.username === username);
  if (usuarioExistente) {
    return res.status(409).json({ message: 'Usuário já cadastrado!' });
  }

  const senhaHash = await bcrypt.hash(password, 10);
  const novoUsuario = {
    id: usuarios.length + 1,
    username,
    password: senhaHash
  };

  usuarios.push(novoUsuario);

  return res.status(201).json({
    message: 'Usuário cadastrado com sucesso!',
    usuario: {
      id: novoUsuario.id,
      username: novoUsuario.username
    }
  });
});

// Rota de login com geração de JWT
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  const usuario = usuarios.find((u) => u.username === username);
  if (!usuario) {
    return res.status(401).json({ message: 'Credenciais inválidas!' });
  }

  const senhaValida = await bcrypt.compare(password, usuario.password);
  if (!senhaValida) {
    return res.status(401).json({ message: 'Credenciais inválidas!' });
  }

  const token = jwt.sign(
    { id: usuario.id, username: usuario.username },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  return res.status(200).json({
    message: 'Login realizado com sucesso!',
    token
  });
});

// Listar todos os alunos
app.get('/alunos', authenticateJWT, (req, res) => {
  return res.status(200).json(alunos);
});

// Listar médias dos alunos (antes de /alunos/:id)
app.get('/alunos/medias', authenticateJWT, (req, res) => {
  const medias = alunos.map((aluno) => {
    const media = Number(((Number(aluno.nota1) + Number(aluno.nota2)) / 2).toFixed(2));
    return {
      id: aluno.id,
      nome: aluno.nome,
      ra: aluno.ra,
      nota1: aluno.nota1,
      nota2: aluno.nota2,
      media
    };
  });

  return res.status(200).json(medias);
});

// Listar situação de aprovação dos alunos (antes de /alunos/:id)
app.get('/alunos/aprovados', authenticateJWT, (req, res) => {
  const resultado = alunos.map((aluno) => {
    const media = Number(((Number(aluno.nota1) + Number(aluno.nota2)) / 2).toFixed(2));
    const situacao = media >= 6 ? 'aprovado' : 'reprovado';
    return {
      id: aluno.id,
      nome: aluno.nome,
      ra: aluno.ra,
      nota1: aluno.nota1,
      nota2: aluno.nota2,
      media,
      situacao
    };
  });

  return res.status(200).json(resultado);
});

// Buscar aluno por ID
app.get('/alunos/:id', authenticateJWT, (req, res) => {
  const id = Number(req.params.id);
  const aluno = alunos.find((a) => a.id === id);

  if (!aluno) {
    return res.status(404).json({ message: 'Aluno não encontrado!' });
  }

  return res.status(200).json(aluno);
});

// Cadastrar novo aluno
app.post('/alunos', authenticateJWT, (req, res) => {
  const { id, nome, ra, nota1, nota2 } = req.body;

  if (
    id === undefined ||
    !nome ||
    !ra ||
    nota1 === undefined ||
    nota2 === undefined
  ) {
    return res.status(400).json({
      message: 'Campos obrigatórios: id, nome, ra, nota1 e nota2!'
    });
  }

  const idInteiro = Number(id);
  const nota1Num = Number(nota1);
  const nota2Num = Number(nota2);

  if (!Number.isInteger(idInteiro) || Number.isNaN(nota1Num) || Number.isNaN(nota2Num)) {
    return res.status(400).json({
      message: 'Tipos inválidos: id deve ser inteiro e nota1/nota2 devem ser numéricos!'
    });
  }

  const alunoExistente = alunos.find((a) => a.id === idInteiro);
  if (alunoExistente) {
    return res.status(409).json({ message: 'Já existe um aluno com esse ID!' });
  }

  const novoAluno = {
    id: idInteiro,
    nome: String(nome),
    ra: String(ra),
    nota1: nota1Num,
    nota2: nota2Num
  };

  alunos.push(novoAluno);

  return res.status(201).json(novoAluno);
});

// Atualizar aluno por ID
app.put('/alunos/:id', authenticateJWT, (req, res) => {
  const id = Number(req.params.id);
  const indice = alunos.findIndex((a) => a.id === id);

  if (indice === -1) {
    return res.status(404).json({ message: 'Aluno não encontrado!' });
  }

  const { nome, ra, nota1, nota2 } = req.body;

  if (nota1 !== undefined && Number.isNaN(Number(nota1))) {
    return res.status(400).json({ message: 'nota1 deve ser um número válido!' });
  }
  if (nota2 !== undefined && Number.isNaN(Number(nota2))) {
    return res.status(400).json({ message: 'nota2 deve ser um número válido!' });
  }

  const alunoAtual = alunos[indice];
  const alunoAtualizado = {
    id: alunoAtual.id,
    nome: nome !== undefined ? String(nome) : alunoAtual.nome,
    ra: ra !== undefined ? String(ra) : alunoAtual.ra,
    nota1: nota1 !== undefined ? Number(nota1) : alunoAtual.nota1,
    nota2: nota2 !== undefined ? Number(nota2) : alunoAtual.nota2
  };

  alunos[indice] = alunoAtualizado;

  return res.status(200).json(alunoAtualizado);
});

// Remover aluno por ID
app.delete('/alunos/:id', authenticateJWT, (req, res) => {
  const id = Number(req.params.id);
  const indice = alunos.findIndex((a) => a.id === id);

  if (indice === -1) {
    return res.status(404).json({ message: 'Aluno não encontrado!' });
  }

  alunos.splice(indice, 1);

  return res.status(200).json({ message: 'Aluno removido com sucesso!' });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});