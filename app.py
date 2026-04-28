
import streamlit as st
import pandas as pd
import numpy as np
import joblib

# Load model and features
model = joblib.load("asd_rf_model.pkl")
feature_cols = joblib.load("feature_cols.pkl")

st.set_page_config(page_title="ASD Screening Tool", page_icon="🧠", layout="centered")

st.title("🧠 Autism Spectrum Disorder Screening Tool")
st.markdown("Answer the following questions based on the AQ-10 screening questionnaire.")
st.markdown("---")

# ── AQ-10 Questions ──────────────────────────────────────────────────────
aq_questions = {
    "A1_Score":  "I often notice small sounds when others do not.",
    "A2_Score":  "I usually concentrate more on the whole picture rather than small details.",
    "A3_Score":  "I find it easy to do more than one thing at once.",
    "A4_Score":  "If there is an interruption, I can switch back to what I was doing quickly.",
    "A5_Score":  "I find it easy to read between the lines when someone is talking to me.",
    "A6_Score":  "I know how to tell if someone listening to me is getting bored.",
    "A7_Score":  "When reading a story, I find it difficult to work out the characters intentions.",
    "A8_Score":  "I like to collect information about categories of things.",
    "A9_Score":  "I find it easy to work out what someone is thinking or feeling just by looking at them.",
    "A10_Score": "I find it difficult to work out peoples intentions.",
}

scores = {}
st.subheader("Part 1: Behavioral Questions")
for col, question in aq_questions.items():
    answer = st.radio(question, options=["Yes", "No"], horizontal=True, key=col)
    scores[col] = 1 if answer == "Yes" else 0

st.markdown("---")
st.subheader("Part 2: Personal Information")

col1, col2 = st.columns(2)
with col1:
    age = st.number_input("Age", min_value=1, max_value=100, value=25)
    gender = st.selectbox("Gender", ["Female", "Male"])
    ethnicity = st.selectbox("Ethnicity", [
        "White-European", "Asian", "Middle Eastern", "Black",
        "South Asian", "Latino", "Hispanic", "Pasifika", "Turkish", "Others"
    ])
with col2:
    jundice   = st.selectbox("Born with jaundice?", ["No", "Yes"])
    austim    = st.selectbox("Family member with ASD?", ["No", "Yes"])
    relation  = st.selectbox("Who is completing the test?", [
        "Self", "Parent", "Relative", "Health care professional", "Others"
    ])
    used_app  = st.selectbox("Used ASD screening app before?", ["No", "Yes"])

# ── Encode inputs ────────────────────────────────────────────────────────
ethnicity_map = {
    "White-European": 9, "Asian": 0, "Middle Eastern": 5,
    "Black": 1, "South Asian": 7, "Latino": 3,
    "Hispanic": 2, "Pasifika": 6, "Turkish": 8, "Others": 4
}
relation_map = {
    "Health care professional": 0, "Others": 1,
    "Parent": 2, "Relative": 3, "Self": 4
}

input_data = {**scores,
    "age":             age,
    "gender":          1 if gender == "Male" else 0,
    "ethnicity":       ethnicity_map[ethnicity],
    "jundice":         1 if jundice == "Yes" else 0,
    "austim":          1 if austim == "Yes" else 0,
    "used_app_before": 1 if used_app == "Yes" else 0,
    "relation":        relation_map[relation],
}

input_df = pd.DataFrame([input_data])[feature_cols]

# ── Predict ──────────────────────────────────────────────────────────────
st.markdown("---")
if st.button("🔍 Run Screening", use_container_width=True):
    prediction = model.predict(input_df)[0]
    probability = model.predict_proba(input_df)[0][1]

    if prediction == 1:
        st.error(f"⚠️ Result: **ASD Traits Detected**")
        st.metric("Confidence", f"{probability*100:.1f}%")
        st.markdown("> This screening suggests ASD traits may be present. "
                    "Please consult a licensed clinical professional for a formal diagnosis.")
    else:
        st.success(f"✅ Result: **No ASD Traits Detected**")
        st.metric("Confidence", f"{(1-probability)*100:.1f}%")
        st.markdown("> This screening does not indicate ASD traits. "
                    "If you have concerns, consult a healthcare professional.")

    st.markdown("---")
    st.caption("⚠️ Disclaimer: This tool is for educational/screening purposes only "
               "and is not a clinical diagnosis.")
