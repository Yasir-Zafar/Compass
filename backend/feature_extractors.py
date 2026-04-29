"""
feature_extractors.py
Single source of truth for all feature extraction.
Used by both the Kaggle training notebook and the FastAPI backend.
DO NOT change feature names or return order without retraining.
"""
import json
import numpy as np
import pandas as pd
import librosa
import cv2
from scipy.signal import find_peaks

def extract_physio_features(csv_path: str) -> dict:
    df = pd.read_csv(csv_path)
    feats = {}
    hr = df["HR"].values
    feats["hr_mean"] = float(np.mean(hr)); feats["hr_std"] = float(np.std(hr))
    feats["hr_min"]  = float(np.min(hr));  feats["hr_max"] = float(np.max(hr))
    feats["hr_range"]= float(np.max(hr)-np.min(hr))
    feats["hr_rmssd"]= float(np.sqrt(np.mean(np.diff(hr)**2)))
    feats["hr_trend"]= float(np.polyfit(np.arange(len(hr)), hr, 1)[0])
    gsr = df["GSR"].values
    feats["gsr_mean"] = float(np.mean(gsr)); feats["gsr_std"] = float(np.std(gsr))
    feats["gsr_min"]  = float(np.min(gsr));  feats["gsr_max"] = float(np.max(gsr))
    feats["gsr_range"]= float(np.max(gsr)-np.min(gsr))
    peaks,_ = find_peaks(gsr, height=np.mean(gsr), distance=5)
    feats["gsr_peak_count"] = float(len(peaks))
    feats["gsr_auc"]        = float(np.trapz(gsr))
    temp = df["TEMP"].values
    feats["temp_mean"] = float(np.mean(temp)); feats["temp_std"] = float(np.std(temp))
    feats["temp_min"]  = float(np.min(temp));  feats["temp_max"] = float(np.max(temp))
    feats["temp_drift"]= float(temp[-1]-temp[0])
    feats["temp_trend"]= float(np.polyfit(np.arange(len(temp)), temp, 1)[0])
    return feats

def extract_motion_features(json_path: str) -> dict:
    with open(json_path,"r") as f: data=json.load(f)
    feats={}
    feats["stimming_detected"]=float(int(data.get("stimming_detected",False)))
    feats["frame_rate"]=float(data.get("frame_rate",30))
    feats["duration_sec"]=float(data.get("duration_sec",10))
    joint_keys=[k for k,v in data.items() if isinstance(v,list) and len(v)>0 and isinstance(v[0],list)]
    all_v,all_e,pjv=[],[],[]
    for joint in joint_keys:
        frames=np.array(data[joint])
        if frames.ndim!=2 or frames.shape[1]!=3: continue
        d=np.linalg.norm(np.diff(frames,axis=0),axis=1)
        all_v.extend(d.tolist()); all_e.append(float(np.sum(d**2))); pjv.append(float(np.var(frames)))
    if all_v:
        vel=np.array(all_v)
        feats["motion_velocity_mean"]=float(np.mean(vel)); feats["motion_velocity_std"]=float(np.std(vel))
        feats["motion_velocity_max"]=float(np.max(vel));   feats["motion_total_energy"]=float(np.sum(all_e))
        feats["motion_joint_var_mean"]=float(np.mean(pjv)); feats["motion_joint_var_std"]=float(np.std(pjv))
    else:
        for k in ["motion_velocity_mean","motion_velocity_std","motion_velocity_max",
                  "motion_total_energy","motion_joint_var_mean","motion_joint_var_std"]: feats[k]=0.0
    if "head" in data and isinstance(data["head"],list):
        head=np.array(data["head"])
        if head.ndim==2 and head.shape[1]==3:
            hd=np.linalg.norm(np.diff(head,axis=0),axis=1)
            feats["head_velocity_mean"]=float(np.mean(hd)); feats["head_velocity_std"]=float(np.std(hd))
            feats["head_range_x"]=float(np.ptp(head[:,0])); feats["head_range_y"]=float(np.ptp(head[:,1]))
            feats["head_range_z"]=float(np.ptp(head[:,2]))
        else:
            for k in ["head_velocity_mean","head_velocity_std","head_range_x","head_range_y","head_range_z"]: feats[k]=0.0
    else:
        for k in ["head_velocity_mean","head_velocity_std","head_range_x","head_range_y","head_range_z"]: feats[k]=0.0
    feats["n_joints_tracked"]=float(len(joint_keys))
    return feats

def extract_voice_features(wav_path: str) -> dict:
    y,sr=librosa.load(wav_path,sr=22050,mono=True)
    feats={}
    mfccs=librosa.feature.mfcc(y=y,sr=sr,n_mfcc=13)
    for i in range(13):
        feats[f"mfcc_{i+1:02d}_mean"]=float(np.mean(mfccs[i]))
        feats[f"mfcc_{i+1:02d}_std"] =float(np.std(mfccs[i]))
    pitches,magnitudes=librosa.piptrack(y=y,sr=sr)
    pv=pitches[magnitudes>np.median(magnitudes)]; pv=pv[pv>0]
    feats["pitch_mean"]=float(np.mean(pv)) if len(pv)>0 else 0.0
    feats["pitch_std"] =float(np.std(pv))  if len(pv)>0 else 0.0
    rms=librosa.feature.rms(y=y)[0]
    feats["rms_mean"]=float(np.mean(rms)); feats["rms_std"]=float(np.std(rms))
    zcr=librosa.feature.zero_crossing_rate(y)[0]
    feats["zcr_mean"]=float(np.mean(zcr)); feats["zcr_std"]=float(np.std(zcr))
    feats["spectral_centroid_mean"] =float(np.mean(librosa.feature.spectral_centroid(y=y,sr=sr)[0]))
    feats["spectral_centroid_std"]  =float(np.std( librosa.feature.spectral_centroid(y=y,sr=sr)[0]))
    feats["spectral_bandwidth_mean"]=float(np.mean(librosa.feature.spectral_bandwidth(y=y,sr=sr)[0]))
    feats["spectral_rolloff_mean"]  =float(np.mean(librosa.feature.spectral_rolloff(y=y,sr=sr)[0]))
    return feats

def extract_image_features(img_path: str, target_size: int = 64) -> dict:
    img=cv2.imread(str(img_path))
    if img is None:
        return ({f"hog_bin_{i:02d}":0.0 for i in range(36)}|
                {f"color_{c}_{s}":0.0 for c in ["r","g","b"] for s in ["mean","std"]}|
                {"brightness":0.0,"contrast":0.0})
    img_rgb=cv2.cvtColor(img,cv2.COLOR_BGR2RGB)
    img_r  =cv2.resize(img_rgb,(target_size,target_size))
    gray   =cv2.cvtColor(img_r,cv2.COLOR_RGB2GRAY)
    feats  ={}
    hog=cv2.HOGDescriptor(_winSize=(target_size,target_size),_blockSize=(16,16),
                           _blockStride=(8,8),_cellSize=(8,8),_nbins=9)
    hog_vec=hog.compute(gray).flatten()
    gs=max(1,len(hog_vec)//36)
    for i in range(36):
        chunk=hog_vec[i*gs:(i+1)*gs]
        feats[f"hog_bin_{i:02d}"]=float(np.mean(chunk)) if len(chunk)>0 else 0.0
    for ci,cn in enumerate(["r","g","b"]):
        ch=img_r[:,:,ci].astype(float)
        feats[f"color_{cn}_mean"]=float(np.mean(ch)); feats[f"color_{cn}_std"]=float(np.std(ch))
    feats["brightness"]=float(np.mean(gray)); feats["contrast"]=float(np.std(gray))
    return feats