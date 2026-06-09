const express = require('express');
const { pool } = require('../db/mysql');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { usuario, clave } = req.body;

  if (!usuario || !clave) {
    return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT e.CODEMP, e.EMPNIT, e.EMPLEADO, e.TIPO, e.USUARIO, e.HABILITADO,
              emp.EMPRESA
       FROM empleados e
       LEFT JOIN empresas emp ON emp.EMPNIT = e.EMPNIT
       WHERE e.USUARIO = ? AND e.CLAVE = ?`,
      [usuario, clave]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    const empleado = rows[0];

    if (empleado.HABILITADO !== 'SI') {
      return res.status(403).json({ error: 'El usuario se encuentra deshabilitado' });
    }

    res.json({
      codemp: empleado.CODEMP,
      empnit: empleado.EMPNIT,
      empleado: empleado.EMPLEADO,
      tipo: empleado.TIPO,
      usuario: empleado.USUARIO,
      empresa: empleado.EMPRESA,
    });
  } catch (error) {
    console.error('Error en login:', error.message);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

module.exports = router;
