import os
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from imblearn.over_sampling import SMOTE
from sklearn.metrics import f1_score, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from xgboost import XGBClassifier


FEATURE_NAMES = [f"v{i}" for i in range(1, 29)] + ["amount", "hour_of_day"]
THRESHOLD = 0.35


def load_dataset() -> tuple[pd.DataFrame, pd.Series]:
    csv_path = Path(__file__).resolve().parents[2] / "creditcard.csv"
    df = pd.read_csv(csv_path)

    df = df.rename(columns={f"V{i}": f"v{i}" for i in range(1, 29)})
    df["amount"] = np.log1p(df["Amount"].clip(lower=0))
    df["hour_of_day"] = ((df["Time"] // 3600) % 24).astype(int)

    return df[FEATURE_NAMES], df["Class"]


def main():
    X, y = load_dataset()

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        stratify=y,
        random_state=42,
    )

    smote = SMOTE(random_state=42)
    X_train_bal, y_train_bal = smote.fit_resample(X_train, y_train)

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train_bal)
    X_test_scaled = scaler.transform(X_test)

    model = XGBClassifier(
        n_estimators=200,
        max_depth=6,
        learning_rate=0.1,
        random_state=42,
        eval_metric="logloss",
    )
    model.fit(X_train_scaled, y_train_bal)
    model.version_ = "v1.0.0-xgboost"

    y_proba = model.predict_proba(X_test_scaled)[:, 1]
    y_pred = (y_proba >= THRESHOLD).astype(int)

    print(f"AUC-ROC: {roc_auc_score(y_test, y_proba):.4f}")
    print(f"F1 Score: {f1_score(y_test, y_pred):.4f}")

    os.makedirs("models", exist_ok=True)
    joblib.dump(model, "models/fraud_model.pkl")
    joblib.dump(scaler, "models/scaler.pkl")
    print("Saved fraud_model.pkl and scaler.pkl")


if __name__ == "__main__":
    main()
