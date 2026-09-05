# 🌦️ SkyGuard AI

### AI/ML-Based Intelligent Anomaly Detection for Automatic Weather Stations

> **Smart India Hackathon 2026 — SIH26073**

SkyGuard AI is an intelligent weather-data quality monitoring and anomaly detection platform designed for **Automatic Weather Stations (AWS)**.

The system combines **Machine Learning, rule-based quality control, statistical analysis, and explainable alerts** to identify abnormal weather observations, detect potential sensor failures, estimate anomaly severity, and monitor the health of weather stations.

---

## 🚨 Problem Statement

Automatic Weather Stations continuously collect critical environmental parameters such as:

* 🌡️ Temperature
* 💧 Relative Humidity
* ⏱️ Atmospheric Pressure

However, AWS sensors can generate incorrect observations because of:

* Sudden sensor spikes
* Sensor drift
* Frozen sensor values
* Physically impossible readings
* Communication failures
* Missing data
* Sensor degradation
* Multivariate inconsistencies

Traditional threshold-based systems can generate excessive false alarms and may fail to identify complex relationships between multiple weather parameters.

### 💡 SkyGuard AI solves this by combining deterministic quality checks with machine learning-based anomaly detection.

---

# 🎯 Our Solution

SkyGuard AI follows a multi-stage intelligent monitoring pipeline:

```text
        Automatic Weather Station
                  │
                  ▼
          Weather Data Collection
                  │
                  ▼
           Data Preprocessing
                  │
                  ▼
          Feature Engineering
                  │
          ┌───────┴────────┐
          ▼                ▼
    Rule-Based QC     Isolation Forest
          │                │
          └───────┬────────┘
                  ▼
          Anomaly Detection
                  │
                  ▼
           Anomaly Scoring
                  │
                  ▼
        Severity Classification
                  │
                  ▼
         Root Cause Analysis
                  │
                  ▼
        Explainable Alert
                  │
                  ▼
             Dashboard
```

---

# ✨ Key Features

## 🤖 1. AI-Based Anomaly Detection

SkyGuard AI uses **Isolation Forest**, an unsupervised machine learning algorithm, to detect unusual weather observations.

The model analyzes:

* Temperature
* Humidity
* Atmospheric Pressure

and identifies observations that significantly differ from normal patterns.

---

## 🔍 2. Rule-Based Quality Control

Machine learning is combined with deterministic validation rules to detect:

* Physically invalid values
* Sudden temperature spikes
* Sudden drops
* Abnormal humidity
* Pressure abnormalities
* Frozen sensor readings
* Missing observations
* Communication failures
* Extreme deviations

This hybrid approach improves reliability compared with using ML alone.

---

## 🧠 3. Explainable AI Alerts

SkyGuard AI does not simply report:

> ❌ Anomaly Detected

Instead, it provides an explanation.

Example:

```text
🚨 Anomaly Detected

Reason:
✓ Temperature significantly outside expected range
✓ Multivariate weather inconsistency
✓ Isolation Forest detected an outlier

Severity: HIGH
Confidence: 94%
```

This helps weather-station operators understand **why** an observation was flagged.

---

# 🚦 4. Severity Classification

Detected anomalies can be categorized into:

| Severity  | Meaning                                    |
| --------- | ------------------------------------------ |
| 🟢 NORMAL | Observation appears normal                 |
| 🟡 MEDIUM | Potential abnormality requiring monitoring |
| 🔴 HIGH   | Strong indication of sensor/data anomaly   |

---

# 📊 5. Confidence Score

Every detected anomaly can be associated with a confidence score.

This allows operators to prioritize the most suspicious observations.

Example:

```text
Anomaly Confidence: 94%
Severity: HIGH
```

---

# 🩺 6. Sensor & Station Health Monitoring

SkyGuard AI can monitor the overall health of weather stations using:

* Number of anomalies
* Frequency of abnormal readings
* Sensor consistency
* Missing observations
* Recent anomaly history

This helps identify stations that may require inspection or maintenance.

---

# 📈 7. Interactive Dashboard

The Streamlit dashboard provides visual monitoring of:

### Weather Telemetry

* 🌡️ Temperature trends
* 💧 Humidity trends
* ⏱️ Pressure trends

### Anomaly Monitoring

* 🚨 Total anomalies
* 📍 Station-wise anomalies
* 📊 Anomaly distribution
* ⚠️ Severity levels
* 🔎 Anomaly explanations

### Station Monitoring

* Station status
* Sensor health
* Total observations
* Detected anomalies

---

# 🧪 8. Multiple Anomaly Types

SkyGuard AI is designed to identify different types of weather-data anomalies.

| Anomaly Type             | Description                                       |
| ------------------------ | ------------------------------------------------- |
| 🌡️ Spike                | Sudden unrealistic change                         |
| 🧊 Frozen Sensor         | Sensor repeatedly reports nearly identical values |
| 📉 Drift                 | Gradual deviation from expected behavior          |
| 📡 Communication Failure | Missing/interrupted observations                  |
| ⚠️ Range Violation       | Value outside physically reasonable limits        |
| 🔀 Multivariate Anomaly  | Combination of parameters is inconsistent         |
| 🤖 ML Anomaly            | Unusual pattern detected by Isolation Forest      |

---

# 🇮🇳 Dataset

The project includes a synthetic weather dataset designed for testing and demonstration.

### Indian Weather Station Dataset

The dataset contains:

* **50 weather stations**
* **50 different Indian cities**
* **1000 weather observations**
* **20 observations per station**
* Temperature
* Humidity
* Atmospheric pressure
* Anomaly labels
* Anomaly type

Example cities include:

```text
Delhi
Mumbai
Kolkata
Chennai
Bengaluru
Hyderabad
Ahmedabad
Pune
Jaipur
Lucknow
Patna
Bhopal
Bhubaneswar
Guwahati
Chandigarh
Srinagar
Shimla
Dehradun
Ranchi
Raipur
...
```

### Dataset Columns

| Column             | Description                 |
| ------------------ | --------------------------- |
| `station_id`       | Unique weather station ID   |
| `city`             | Indian city                 |
| `state`            | Indian state/UT             |
| `temperature_C`    | Temperature in Celsius      |
| `humidity_percent` | Relative humidity           |
| `pressure_hPa`     | Atmospheric pressure        |
| `anomaly`          | `0 = Normal`, `1 = Anomaly` |
| `anomaly_type`     | Type of detected anomaly    |

### Dataset Statistics

```text
Stations       : 50
Observations   : 1000
Anomalies      : 46
Normal Records : 954
```

> **Note:** The included dataset is synthetic and intended for prototype development, ML testing and demonstration. It should not be treated as official meteorological observations.

---

# 🧠 Machine Learning Approach

## Isolation Forest

SkyGuard AI uses the **Isolation Forest** algorithm for unsupervised anomaly detection.

Isolation Forest works by isolating unusual observations from normal observations.

### Input Features

```text
Temperature
Humidity
Pressure
```

### ML Pipeline

```text
Raw Weather Data
       │
       ▼
Missing Value Handling
       │
       ▼
Data Preprocessing
       │
       ▼
Feature Preparation
       │
       ▼
Isolation Forest
       │
       ▼
Anomaly Prediction
       │
       ▼
Anomaly Score
       │
       ▼
Severity + Confidence
```

The ML model is combined with rule-based validation to improve practical weather-data quality monitoring.

---

# 🛠️ Technology Stack

## Frontend / Dashboard

* **Streamlit**
* **Plotly**

## Programming

* **Python**

## Data Processing

* **Pandas**
* **NumPy**

## Machine Learning

* **Scikit-learn**
* **Isolation Forest**

## Data

* CSV-based weather telemetry
* Synthetic Indian AWS dataset

## Development

* Git
* GitHub
* VS Code

---

# 📁 Project Structure

```text
SkyGuard-AI/
│
├── app.py
├── anomaly_detector.py
├── preprocessing.py
├── generate_data.py
├── requirements.txt
├── README.md
├── .gitignore
│
└── data/
    ├── weather_data.csv
    └── india_weather_anomaly_50_stations.csv
```

### File Description

| File                                    | Purpose                           |
| --------------------------------------- | --------------------------------- |
| `app.py`                                | Main Streamlit dashboard          |
| `anomaly_detector.py`                   | ML + rule-based anomaly detection |
| `preprocessing.py`                      | Data loading and preprocessing    |
| `generate_data.py`                      | Generates sample weather data     |
| `requirements.txt`                      | Python dependencies               |
| `india_weather_anomaly_50_stations.csv` | 50-station Indian weather dataset |
| `README.md`                             | Project documentation             |

---

# ⚙️ Installation

## 1. Clone the Repository

```bash
git clone https://github.com/Medhavi1906/SkyGuard-AI.git
```

## 2. Navigate to the Project

```bash
cd SkyGuard-AI
```

## 3. Create a Virtual Environment

### Windows

```powershell
python -m venv venv
venv\Scripts\activate
```

### Linux / macOS

```bash
python3 -m venv venv
source venv/bin/activate
```

---

# 📦 Install Dependencies

```bash
python -m pip install -r requirements.txt
```

---

# ▶️ Run SkyGuard AI

Start the Streamlit application:

```bash
python -m streamlit run app.py
```

The application will be available at:

```text
http://localhost:8501
```

---

# 🧪 Generate Demo Data

To generate sample weather observations:

```bash
python generate_data.py
```

The generated data can then be processed by the anomaly detection pipeline.

---

# 📊 Example Detection

Example input:

```text
Temperature : 48.7 °C
Humidity    : 31 %
Pressure    : 1008 hPa
```

SkyGuard AI may produce:

```text
🚨 ANOMALY DETECTED

Type       : Temperature Anomaly
Severity   : HIGH
Confidence : 92%

Reason:
Temperature is significantly different from
the expected weather pattern.
```

---

# 🌍 Real-World Applications

SkyGuard AI can be useful for:

* 🌦️ Meteorological monitoring
* 🌾 Smart agriculture
* 🌊 Flood and extreme-weather monitoring
* 🏙️ Smart cities
* 🚨 Disaster management
* ✈️ Aviation weather monitoring
* 🌡️ Climate-data quality control
* 🛰️ Large-scale AWS networks

---

# 🚀 Future Enhancements

The project can be extended with:

* Real-time AWS/IoT data ingestion
* Live weather APIs
* Streaming anomaly detection
* LSTM-based time-series anomaly detection
* Autoencoder-based anomaly detection
* Advanced sensor drift detection
* Station geospatial maps
* Automated maintenance alerts
* Cloud deployment
* Docker support
* REST API integration
* Database-backed telemetry storage
* Historical anomaly analytics
* Email/SMS notifications
* Advanced explainable AI

---

# 🎯 Why SkyGuard AI?

Traditional monitoring often depends heavily on fixed thresholds.

SkyGuard AI introduces a **hybrid intelligent approach**:

```text
Rule-Based Validation
          +
Machine Learning
          +
Anomaly Scoring
          +
Explainable Alerts
          +
Station Health Monitoring
```

This makes the system more suitable for detecting both **obvious sensor failures and unusual multivariate weather patterns**.

---

# 🏆 Smart India Hackathon 2026

SkyGuard AI is developed as a solution for the **Smart India Hackathon 2026** problem statement:

> **AI/ML-Based Intelligent Anomaly Detection for Automatic Weather Stations**

The objective is to improve the reliability and quality of weather observations by automatically detecting suspicious sensor readings and providing actionable insights.

---

# 👩‍💻 Project

**SkyGuard AI**

Developed for:

**Smart India Hackathon 2026**

Repository:

**https://github.com/Medhavi1906/SkyGuard-AI**

---

# 📜 License

This project is intended for educational, research and prototype development purposes.

---

## ⭐ Support the Project

If you find SkyGuard AI useful, consider giving the repository a ⭐ on GitHub!
