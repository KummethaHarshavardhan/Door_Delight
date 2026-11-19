import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SkipForward } from 'lucide-react';
import { INTRO_SCENES, TOTAL_INTRO_DURATION, getSceneAt } from './intro/IntroTimeline';
import ParticleCanvas from './intro/ParticleCanvas';
import GirlCharacter from './intro/GirlCharacter';
import FoodMarket from './intro/FoodMarket';
import ChineseChefScene from './intro/ChineseChefScene';
import PizzaBurgerScene from './intro/PizzaBurgerScene';
import IndianFoodScene from './intro/IndianFoodScene';
import DessertScene from './intro/DessertScene';
import CircularBrandReveal from './intro/CircularBrandReveal';
import './intro/intro.css';

const MUSIC_SRC = '/audio/intro-music-40s.wav';
const VOICE_SRC = '/audio/doordelight-voice.wav';

export default function AnimeIntro({ onComplete }) {
  const [elapsed, setElapsed] = useState(0);

  const musicRef = useRef(null);
  const voiceRef = useRef(null);
  const voicePlayedRef = useRef(false);
  const rafRef = useRef(null);
  const startTimeRef = useRef(performance.now());
  const completedRef = useRef(false);

  const stopAllAudio = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    [musicRef.current, voiceRef.current].forEach((audio) => {
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
    });
  }, []);

  const finishIntro = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    stopAllAudio();
    sessionStorage.setItem('dd_intro_seen', '1');
    onComplete();
  }, [onComplete, stopAllAudio]);

  useEffect(() => {
    [
      '/anime/girl-back-sunset.jpg',
      '/anime/girl-front-closed.jpg',
      '/anime/girl-front-open.jpg',
      '/anime/anime-food-market.jpg',
      '/anime/anime-chinese-chef.jpg',
      '/anime/anime-pizza-burger.jpg',
      '/anime/anime-indian-biryani.jpg',
      '/anime/anime-desserts-drinks.jpg',
    ].forEach((src) => {
      const img = new Image();
      img.src = src;
    });

    const music = new Audio(MUSIC_SRC);
    const voice = new Audio(VOICE_SRC);
    music.preload = 'auto';
    voice.preload = 'auto';
    music.volume = 0.72;
    musicRef.current = music;
    voiceRef.current = voice;

    // Attempt autoplay with sound immediately; no sound-selection or mute UI
    music.play().catch(() => {});

    startTimeRef.current = performance.now();

    const tick = (now) => {
      const t = Math.min(TOTAL_INTRO_DURATION, (now - startTimeRef.current) / 1000);
      setElapsed(t);

      // Smoothly lower music volume around 34s-36.6s for the spoken brand voice
      if (musicRef.current) {
        if (t < 34.0) {
          musicRef.current.volume = 0.72;
        } else if (t < 36.6) {
          musicRef.current.volume = Math.max(0.14, 0.72 - ((t - 34.0) / 2.6) * 0.58);
        } else {
          musicRef.current.volume = Math.max(0.05, 0.14 * (1 - (t - 36.6) / 3.4));
        }
      }

      // Play spoken "DoorDelight!" at 37.0 seconds
      if (t >= 37.0 && !voicePlayedRef.current) {
        voicePlayedRef.current = true;
        if (voiceRef.current) {
          voiceRef.current.currentTime = 0;
          voiceRef.current.volume = 1.0;
          voiceRef.current.play().catch(() => {});
        }
      }

      if (t >= TOTAL_INTRO_DURATION) {
        finishIntro();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      stopAllAudio();
    };
  }, [finishIntro, stopAllAudio]);

  const sceneId = getSceneAt(elapsed);
  const sceneMeta = INTRO_SCENES.find((s) => s.id === sceneId);

  return (
    <div className="intro-cinema-root">
      <div className="intro-hud-top">
        <div className="intro-scene-pill">
          Scene {sceneId}/8 • {sceneMeta?.title}
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={finishIntro}>
          <SkipForward size={16} /> SKIP INTRO
        </button>
      </div>

      {sceneId <= 2 && <GirlCharacter elapsed={elapsed} />}
      {sceneId === 3 && <FoodMarket elapsed={elapsed} />}
      {sceneId === 4 && <ChineseChefScene elapsed={elapsed} />}
      {sceneId === 5 && <PizzaBurgerScene elapsed={elapsed} />}
      {sceneId === 6 && <IndianFoodScene elapsed={elapsed} />}
      {sceneId === 7 && <DessertScene elapsed={elapsed} />}
      {sceneId === 8 && <CircularBrandReveal elapsed={elapsed} />}

      <ParticleCanvas scene={sceneId} />

      <div className="intro-progress-bar">
        <div
          className="intro-progress-fill"
          style={{ width: `${(elapsed / TOTAL_INTRO_DURATION) * 100}%` }}
        />
      </div>
    </div>
  );
}
