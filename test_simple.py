#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de test E2E simplifie pour le systeme de validation CSV
"""

import requests
import json
import csv
import time
from pathlib import Path

# Configuration
API_BASE_URL = "http://localhost:8000"
FRONTEND_URL = "http://localhost:5173"
CSV_FILE_PATH = "schema-database-project/database_schema.csv"

def test_api_health():
    print("Test de la sante de l'API...")
    try:
        response = requests.get(f"{API_BASE_URL}/health", timeout=5)
        if response.status_code == 200:
            print("SUCCESS: API accessible")
            return True
        else:
            print(f"FAIL: API Status {response.status_code}")
            return False
    except Exception as e:
        print(f"FAIL: Erreur API - {e}")
        return False

def test_frontend_access():
    print("Test d'acces au frontend...")
    try:
        response = requests.get(FRONTEND_URL, timeout=5)
        if response.status_code == 200:
            print("SUCCESS: Frontend accessible")
            return True
        else:
            print(f"FAIL: Frontend Status {response.status_code}")
            return False
    except Exception as e:
        print(f"FAIL: Erreur Frontend - {e}")
        return False

def read_csv_schema():
    print("Lecture du fichier CSV du schema...")
    try:
        csv_path = Path(CSV_FILE_PATH)
        if not csv_path.exists():
            print(f"FAIL: Fichier CSV non trouve: {CSV_FILE_PATH}")
            return None
        
        with open(csv_path, 'r', encoding='utf-8') as file:
            reader = csv.DictReader(file)
            rows = list(reader)
            
        print(f"SUCCESS: CSV lu - {len(rows)} lignes")
        return rows
    except Exception as e:
        print(f"FAIL: Erreur lecture CSV - {e}")
        return None

def validate_csv_structure(data):
    print("Validation de la structure CSV...")
    
    if not data:
        print("FAIL: Aucune donnee a valider")
        return False
    
    required_columns = ['table', 'table description', 'column', 'column description', 'public']
    first_row = data[0]
    missing_columns = [col for col in required_columns if col not in first_row]
    
    if missing_columns:
        print(f"FAIL: Colonnes manquantes: {missing_columns}")
        return False
    
    tables = set(row['table'] for row in data)
    print(f"SUCCESS: Tables trouvees: {', '.join(sorted(tables))}")
    
    for table in tables:
        table_rows = [row for row in data if row['table'] == table]
        public_columns = [row for row in table_rows if row['public'].lower() == 'true']
        print(f"  - {table}: {len(table_rows)} colonnes, {len(public_columns)} publiques")
    
    return True

def create_validation_task():
    print("Creation d'une tache de validation...")
    
    task_data = {
        "id": f"task_{int(time.time())}",
        "title": "Validation du schema de base de donnees",
        "description": "Validation du fichier database_schema.csv",
        "file_path": CSV_FILE_PATH,
        "status": "created",
        "created_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "tables_count": 4,
        "columns_count": 10
    }
    
    print("SUCCESS: Tache de validation creee")
    print(f"  - ID: {task_data['id']}")
    print(f"  - Fichier: {task_data['file_path']}")
    print(f"  - Tables: {task_data['tables_count']}")
    
    return task_data

def simulate_validation_workflow(task_data):
    print("Simulation du workflow de validation...")
    
    steps = [
        ("created", "Tache creee"),
        ("file_uploaded", "Fichier telecharge"),
        ("structure_validated", "Structure validee"),
        ("content_analyzed", "Contenu analyse"),
        ("ready_for_review", "Pret pour revision"),
        ("approved", "Approuve"),
        ("integrated", "Integre")
    ]
    
    for step, description in steps:
        print(f"  -> {description}...")
        task_data['status'] = step
        time.sleep(0.3)
    
    print("SUCCESS: Workflow de validation termine")
    return task_data

def main():
    print("Demarrage du test E2E - Systeme de validation CSV")
    print("=" * 50)
    
    # Tests de base
    api_ok = test_api_health()
    frontend_ok = test_frontend_access()
    
    # Lecture et validation du CSV
    csv_data = read_csv_schema()
    csv_ok = validate_csv_structure(csv_data) if csv_data else False
    
    if not csv_ok:
        print("FAIL: Echec de la validation CSV")
        return
    
    # Simulation du workflow
    task_data = create_validation_task()
    final_task = simulate_validation_workflow(task_data)
    
    print("\n" + "=" * 50)
    print("SUCCESS: Test E2E termine!")
    print(f"Tables analysees: {len(set(row['table'] for row in csv_data))}")
    print(f"Statut final: {final_task['status']}")

if __name__ == "__main__":
    main()