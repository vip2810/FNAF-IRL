@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title FNAF IRL

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js n'est pas installe.
  echo Telechargez la version LTS ici : https://nodejs.org/fr
  echo Puis relancez ce fichier.
  pause
  exit /b 1
)

if not exist node_modules (
  echo === Installation des dependances ^(premiere fois, ~1 min^) ===
  call npm install
  if errorlevel 1 (
    echo L'installation a echoue. Voir le message ci-dessus.
    pause
    exit /b 1
  )
)

echo === Compilation du site ===
call npm run build
if errorlevel 1 (
  echo La compilation a echoue. Voir le message ci-dessus.
  pause
  exit /b 1
)

echo.
echo === Demarrage du jeu ===
echo Surveillant ^(ce PC^)      : http://localhost:3000/guard
echo Monstres ^(telephones^)    : http://IP-du-PC:3000/monster ^(meme Wi-Fi, IP affichee ci-dessous^)
echo Configuration des cameras : http://localhost:3000/admin
echo.
echo Laissez cette fenetre ouverte pendant la partie. Fermez-la pour arreter le jeu.
echo.
start "" http://localhost:3000/guard
call npm start
pause
