'use client';

// Efeito "vapor": o texto é amostrado num canvas e dissolvido em partículas.
// Portado de vapour-text-effect.tsx (21st.dev) para JavaScript puro —
// este projeto não usa TypeScript (ver CLAUDE.md).
import React, { useRef, useEffect, useState, createElement, useMemo, useCallback, memo } from 'react';

export const Tag = {
  H1: 'h1',
  H2: 'h2',
  H3: 'h3',
  P: 'p',
};

export default function VaporizeTextCycle({
  texts = ['Next.js', 'React'],
  font = {
    fontFamily: 'sans-serif',
    fontSize: '50px',
    fontWeight: 400,
  },
  color = 'rgb(255, 255, 255)',
  spread = 5,
  density = 5,
  animation = {
    vaporizeDuration: 2,
    fadeInDuration: 1,
    waitDuration: 0.5,
  },
  direction = 'left-to-right',
  alignment = 'center',
  tag = Tag.P,
}) {
  const canvasRef = useRef(null);
  const wrapperRef = useRef(null);
  const isInView = useIsInView(wrapperRef);
  const lastFontRef = useRef(null);
  const particlesRef = useRef([]);
  const animationFrameRef = useRef(null);
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const [animationState, setAnimationState] = useState('static');
  const vaporizeProgressRef = useRef(0);
  const fadeOpacityRef = useRef(0);
  const [wrapperSize, setWrapperSize] = useState({ width: 0, height: 0 });
  const transformedDensity = transformValue(density, [0, 10], [0.3, 1], true);

  const globalDpr = useMemo(() => {
    if (typeof window !== 'undefined') {
      return window.devicePixelRatio * 1.5 || 1;
    }
    return 1;
  }, []);

  const wrapperStyle = useMemo(() => ({
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
  }), []);

  const canvasStyle = useMemo(() => ({
    minWidth: '30px',
    minHeight: '20px',
    pointerEvents: 'none',
  }), []);

  const animationDurations = useMemo(() => ({
    VAPORIZE_DURATION: (animation.vaporizeDuration ?? 2) * 1000,
    FADE_IN_DURATION: (animation.fadeInDuration ?? 1) * 1000,
    WAIT_DURATION: (animation.waitDuration ?? 0.5) * 1000,
  }), [animation.vaporizeDuration, animation.fadeInDuration, animation.waitDuration]);

  const fontConfig = useMemo(() => {
    const fontSize = parseInt(font.fontSize?.replace('px', '') || '50');
    const VAPORIZE_SPREAD = calculateVaporizeSpread(fontSize);
    const MULTIPLIED_VAPORIZE_SPREAD = VAPORIZE_SPREAD * spread;
    return {
      fontSize,
      VAPORIZE_SPREAD,
      MULTIPLIED_VAPORIZE_SPREAD,
      font: `${font.fontWeight ?? 400} ${fontSize * globalDpr}px ${font.fontFamily}`,
    };
  }, [font.fontSize, font.fontWeight, font.fontFamily, spread, globalDpr]);

  const memoizedUpdateParticles = useCallback((particles, vaporizeX, deltaTime) => {
    return updateParticles(
      particles,
      vaporizeX,
      deltaTime,
      fontConfig.MULTIPLIED_VAPORIZE_SPREAD,
      animationDurations.VAPORIZE_DURATION,
      direction,
      transformedDensity
    );
  }, [fontConfig.MULTIPLIED_VAPORIZE_SPREAD, animationDurations.VAPORIZE_DURATION, direction, transformedDensity]);

  const memoizedRenderParticles = useCallback((ctx, particles) => {
    renderParticles(ctx, particles, globalDpr);
  }, [globalDpr]);

  // Inicia o ciclo quando entra na viewport
  useEffect(() => {
    if (isInView) {
      const startAnimationTimeout = setTimeout(() => {
        setAnimationState('vaporizing');
      }, 0);
      return () => clearTimeout(startAnimationTimeout);
    } else {
      setAnimationState('static');
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    }
  }, [isInView]);

  // Loop de animação — só roda quando visível
  useEffect(() => {
    if (!isInView) return;

    let lastTime = performance.now();
    let frameId;

    const animate = (currentTime) => {
      const deltaTime = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');

      if (!canvas || !ctx || !particlesRef.current.length) {
        frameId = requestAnimationFrame(animate);
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      switch (animationState) {
        case 'static': {
          memoizedRenderParticles(ctx, particlesRef.current);
          break;
        }
        case 'vaporizing': {
          vaporizeProgressRef.current += deltaTime * 100 / (animationDurations.VAPORIZE_DURATION / 1000);

          const textBoundaries = canvas.textBoundaries;
          if (!textBoundaries) break;

          const progress = Math.min(100, vaporizeProgressRef.current);
          const vaporizeX = direction === 'left-to-right'
            ? textBoundaries.left + textBoundaries.width * progress / 100
            : textBoundaries.right - textBoundaries.width * progress / 100;

          const allVaporized = memoizedUpdateParticles(particlesRef.current, vaporizeX, deltaTime);
          memoizedRenderParticles(ctx, particlesRef.current);

          if (vaporizeProgressRef.current >= 100 && allVaporized) {
            setCurrentTextIndex((prevIndex) => (prevIndex + 1) % texts.length);
            setAnimationState('fadingIn');
            fadeOpacityRef.current = 0;
          }
          break;
        }
        case 'fadingIn': {
          fadeOpacityRef.current += deltaTime * 1000 / animationDurations.FADE_IN_DURATION;

          ctx.save();
          ctx.scale(globalDpr, globalDpr);
          particlesRef.current.forEach((particle) => {
            particle.x = particle.originalX;
            particle.y = particle.originalY;
            const opacity = Math.min(fadeOpacityRef.current, 1) * particle.originalAlpha;
            const particleColor = particle.color.replace(/[\d.]+\)$/, `${opacity})`);
            ctx.fillStyle = particleColor;
            ctx.fillRect(particle.x / globalDpr, particle.y / globalDpr, 1, 1);
          });
          ctx.restore();

          if (fadeOpacityRef.current >= 1) {
            setAnimationState('waiting');
            setTimeout(() => {
              setAnimationState('vaporizing');
              vaporizeProgressRef.current = 0;
              resetParticles(particlesRef.current);
            }, animationDurations.WAIT_DURATION);
          }
          break;
        }
        case 'waiting': {
          memoizedRenderParticles(ctx, particlesRef.current);
          break;
        }
      }

      frameId = requestAnimationFrame(animate);
    };

    frameId = requestAnimationFrame(animate);

    return () => {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [
    animationState,
    isInView,
    texts.length,
    direction,
    globalDpr,
    memoizedUpdateParticles,
    memoizedRenderParticles,
    animationDurations.FADE_IN_DURATION,
    animationDurations.WAIT_DURATION,
    animationDurations.VAPORIZE_DURATION,
  ]);

  useEffect(() => {
    renderCanvas({
      framerProps: { texts, font, color, alignment },
      canvasRef,
      wrapperSize,
      particlesRef,
      globalDpr,
      currentTextIndex,
      transformedDensity,
    });

    const currentFont = font.fontFamily || 'sans-serif';
    return handleFontChange({
      currentFont,
      lastFontRef,
      canvasRef,
      wrapperSize,
      particlesRef,
      globalDpr,
      currentTextIndex,
      transformedDensity,
      framerProps: { texts, font, color, alignment },
    });
  }, [texts, font, color, alignment, wrapperSize, currentTextIndex, globalDpr, transformedDensity]);

  // Redimensionamento
  useEffect(() => {
    const container = wrapperRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setWrapperSize({ width, height });
      }

      renderCanvas({
        framerProps: { texts, font, color, alignment },
        canvasRef,
        wrapperSize: { width: container.clientWidth, height: container.clientHeight },
        particlesRef,
        globalDpr,
        currentTextIndex,
        transformedDensity,
      });
    });

    resizeObserver.observe(container);
    return () => {
      resizeObserver.disconnect();
    };
  }, [wrapperRef.current]);

  // Tamanho inicial
  useEffect(() => {
    if (wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      setWrapperSize({ width: rect.width, height: rect.height });
    }
  }, []);

  return (
    <div ref={wrapperRef} style={wrapperStyle}>
      <canvas ref={canvasRef} style={canvasStyle} />
      <SeoElement tag={tag} texts={texts} />
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// VaporizeImage — mesma técnica de partículas, mas amostrando uma
// imagem (ex.: logo) em vez de texto. Mostra a imagem nítida durante
// `delay` segundos e então a dissolve uma única vez.
// ────────────────────────────────────────────────────────────
export function VaporizeImage({
  src,
  alt = '',
  spread = 5,
  density = 5,
  delay = 0.9,
  vaporizeDuration = 1.7,
  direction = 'left-to-right',
  onError,
}) {
  const wrapperRef = useRef(null);
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const imgRef = useRef(null);
  const progressRef = useRef(0);
  const startRef = useRef(null);
  const spreadRef = useRef(1);
  const [pronto, setPronto] = useState(false);
  const [ratio, setRatio] = useState(null);
  const [wrapperSize, setWrapperSize] = useState({ width: 0, height: 0 });
  const transformedDensity = transformValue(density, [0, 10], [0.3, 1], true);

  const globalDpr = useMemo(() => {
    if (typeof window !== 'undefined') {
      return window.devicePixelRatio * 1.5 || 1;
    }
    return 1;
  }, []);

  // Carrega a imagem (mesma origem — getImageData exige canvas não-contaminado)
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setRatio(img.naturalWidth / img.naturalHeight);
      setPronto(true);
    };
    img.onerror = (e) => { if (onError) onError(e); };
    img.src = src;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  // Observa o tamanho do wrapper
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWrapperSize({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Amostra as partículas quando imagem + tamanho estão prontos
  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !pronto || !wrapperSize.width || !wrapperSize.height) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = wrapperSize;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.width = Math.floor(width * globalDpr);
    canvas.height = Math.floor(height * globalDpr);

    // desenho "contain" centralizado
    const escala = Math.min(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight);
    const dw = img.naturalWidth * escala;
    const dh = img.naturalHeight * escala;
    const dx = (canvas.width - dw) / 2;
    const dy = (canvas.height - dh) / 2;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, dx, dy, dw, dh);

    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const currentDPR = canvas.width / parseInt(canvas.style.width);
    const sampleRate = Math.max(1, Math.round(currentDPR / 3));

    const particles = [];
    for (let y = 0; y < canvas.height; y += sampleRate) {
      for (let x = 0; x < canvas.width; x += sampleRate) {
        const i = (y * canvas.width + x) * 4;
        const alpha = data[i + 3];
        if (alpha > 0) {
          const originalAlpha = alpha / 255 * (sampleRate / currentDPR);
          particles.push({
            x, y, originalX: x, originalY: y,
            color: `rgba(${data[i]}, ${data[i + 1]}, ${data[i + 2]}, ${originalAlpha})`,
            opacity: originalAlpha,
            originalAlpha,
            velocityX: 0, velocityY: 0, angle: 0, speed: 0,
          });
        }
      }
    }

    particlesRef.current = particles;
    canvas.textBoundaries = { left: dx, right: dx + dw, width: dw };
    canvas.imageDraw = { dx, dy, dw, dh };
    // spread proporcional à altura desenhada (análogo ao fontSize do texto)
    spreadRef.current = calculateVaporizeSpread(dh / globalDpr) * spread;
    progressRef.current = 0;
    startRef.current = null;
  }, [pronto, wrapperSize, globalDpr, spread]);

  // Loop: imagem nítida até o delay, depois vaporiza (uma vez só)
  useEffect(() => {
    if (!pronto) return;
    let last = performance.now();
    let frameId;

    const animate = (t) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      const img = imgRef.current;
      const dt = (t - last) / 1000;
      last = t;

      if (!canvas || !ctx || !img || !particlesRef.current.length) {
        frameId = requestAnimationFrame(animate);
        return;
      }
      if (startRef.current === null) startRef.current = t;
      const decorrido = (t - startRef.current) / 1000;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (decorrido < delay) {
        // fase estática: desenha a imagem real (mais nítida que partículas)
        const { dx, dy, dw, dh } = canvas.imageDraw;
        ctx.drawImage(img, dx, dy, dw, dh);
      } else {
        progressRef.current += dt * 100 / vaporizeDuration;
        const tb = canvas.textBoundaries;
        if (tb) {
          const progress = Math.min(100, progressRef.current);
          const vaporizeX = direction === 'left-to-right'
            ? tb.left + tb.width * progress / 100
            : tb.right - tb.width * progress / 100;
          updateParticles(
            particlesRef.current, vaporizeX, dt,
            spreadRef.current, vaporizeDuration * 1000, direction, transformedDensity
          );
        }
        renderParticles(ctx, particlesRef.current, globalDpr);
      }
      frameId = requestAnimationFrame(animate);
    };

    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [pronto, delay, vaporizeDuration, direction, globalDpr, transformedDensity]);

  return (
    <div
      ref={wrapperRef}
      role="img"
      aria-label={alt}
      style={{ width: '100%', aspectRatio: ratio ?? undefined, pointerEvents: 'none' }}
    >
      <canvas ref={canvasRef} style={{ pointerEvents: 'none' }} />
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Elemento SEO (texto real, escondido, pra leitores de tela/indexação)
// ────────────────────────────────────────────────────────────
const SeoElement = memo(function SeoElement({ tag = Tag.P, texts }) {
  const style = useMemo(() => ({
    position: 'absolute',
    width: '0',
    height: '0',
    overflow: 'hidden',
    userSelect: 'none',
    pointerEvents: 'none',
  }), []);

  const safeTag = Object.values(Tag).includes(tag) ? tag : 'p';
  return createElement(safeTag, { style }, texts?.join(' ') ?? '');
});

// ────────────────────────────────────────────────────────────
// Troca de fonte: re-renderiza 1s depois pra capturar a webfont carregada
// ────────────────────────────────────────────────────────────
const handleFontChange = ({
  currentFont, lastFontRef, canvasRef, wrapperSize, particlesRef,
  globalDpr, currentTextIndex, transformedDensity, framerProps,
}) => {
  if (currentFont !== lastFontRef.current) {
    lastFontRef.current = currentFont;

    const timeoutId = setTimeout(() => {
      cleanup({ canvasRef, particlesRef });
      renderCanvas({
        framerProps, canvasRef, wrapperSize, particlesRef,
        globalDpr, currentTextIndex, transformedDensity,
      });
    }, 1000);

    return () => {
      clearTimeout(timeoutId);
      cleanup({ canvasRef, particlesRef });
    };
  }

  return undefined;
};

const cleanup = ({ canvasRef, particlesRef }) => {
  const canvas = canvasRef.current;
  const ctx = canvas?.getContext('2d');

  if (canvas && ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  if (particlesRef.current) {
    particlesRef.current = [];
  }
};

// ────────────────────────────────────────────────────────────
// Renderiza o texto no canvas e amostra partículas
// ────────────────────────────────────────────────────────────
const renderCanvas = ({
  framerProps, canvasRef, wrapperSize, particlesRef,
  globalDpr, currentTextIndex, transformedDensity,
}) => {
  const canvas = canvasRef.current;
  if (!canvas || !wrapperSize.width || !wrapperSize.height) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const { width, height } = wrapperSize;

  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.width = Math.floor(width * globalDpr);
  canvas.height = Math.floor(height * globalDpr);

  const fontSize = parseInt(framerProps.font?.fontSize?.replace('px', '') || '50');
  const font = `${framerProps.font?.fontWeight ?? 400} ${fontSize * globalDpr}px ${framerProps.font?.fontFamily ?? 'sans-serif'}`;
  const color = parseColor(framerProps.color ?? 'rgb(153, 153, 153)');

  let textX;
  const textY = canvas.height / 2;
  const currentText = framerProps.texts[currentTextIndex] || 'Next.js';

  if (framerProps.alignment === 'center') {
    textX = canvas.width / 2;
  } else if (framerProps.alignment === 'left') {
    textX = 0;
  } else {
    textX = canvas.width;
  }

  const { particles, textBoundaries } = createParticles(
    ctx, canvas, currentText, textX, textY, font, color, framerProps.alignment || 'left'
  );

  particlesRef.current = particles;
  canvas.textBoundaries = textBoundaries;
};

const createParticles = (ctx, canvas, text, textX, textY, font, color, alignment) => {
  const particles = [];

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = color;
  ctx.font = font;
  ctx.textAlign = alignment;
  ctx.textBaseline = 'middle';
  ctx.imageSmoothingQuality = 'high';
  ctx.imageSmoothingEnabled = true;

  if ('fontKerning' in ctx) {
    ctx.fontKerning = 'normal';
  }
  if ('textRendering' in ctx) {
    ctx.textRendering = 'geometricPrecision';
  }

  const metrics = ctx.measureText(text);
  let textLeft;
  const textWidth = metrics.width;

  if (alignment === 'center') {
    textLeft = textX - textWidth / 2;
  } else if (alignment === 'left') {
    textLeft = textX;
  } else {
    textLeft = textX - textWidth;
  }

  const textBoundaries = {
    left: textLeft,
    right: textLeft + textWidth,
    width: textWidth,
  };

  ctx.fillText(text, textX, textY);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  const baseDPR = 3;
  const currentDPR = canvas.width / parseInt(canvas.style.width);
  const baseSampleRate = Math.max(1, Math.round(currentDPR / baseDPR));
  const sampleRate = Math.max(1, Math.round(baseSampleRate));

  for (let y = 0; y < canvas.height; y += sampleRate) {
    for (let x = 0; x < canvas.width; x += sampleRate) {
      const index = (y * canvas.width + x) * 4;
      const alpha = data[index + 3];

      if (alpha > 0) {
        const originalAlpha = alpha / 255 * (sampleRate / currentDPR);
        particles.push({
          x,
          y,
          originalX: x,
          originalY: y,
          color: `rgba(${data[index]}, ${data[index + 1]}, ${data[index + 2]}, ${originalAlpha})`,
          opacity: originalAlpha,
          originalAlpha,
          velocityX: 0,
          velocityY: 0,
          angle: 0,
          speed: 0,
        });
      }
    }
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  return { particles, textBoundaries };
};

const updateParticles = (
  particles, vaporizeX, deltaTime,
  MULTIPLIED_VAPORIZE_SPREAD, VAPORIZE_DURATION, direction, density
) => {
  let allParticlesVaporized = true;

  particles.forEach((particle) => {
    const shouldVaporize = direction === 'left-to-right'
      ? particle.originalX <= vaporizeX
      : particle.originalX >= vaporizeX;

    if (shouldVaporize) {
      if (particle.speed === 0) {
        particle.angle = Math.random() * Math.PI * 2;
        particle.speed = (Math.random() * 1 + 0.5) * MULTIPLIED_VAPORIZE_SPREAD;
        particle.velocityX = Math.cos(particle.angle) * particle.speed;
        particle.velocityY = Math.sin(particle.angle) * particle.speed;
        particle.shouldFadeQuickly = Math.random() > density;
      }

      if (particle.shouldFadeQuickly) {
        particle.opacity = Math.max(0, particle.opacity - deltaTime);
      } else {
        const dx = particle.originalX - particle.x;
        const dy = particle.originalY - particle.y;
        const distanceFromOrigin = Math.sqrt(dx * dx + dy * dy);

        const dampingFactor = Math.max(0.95, 1 - distanceFromOrigin / (100 * MULTIPLIED_VAPORIZE_SPREAD));

        const randomSpread = MULTIPLIED_VAPORIZE_SPREAD * 3;
        const spreadX = (Math.random() - 0.5) * randomSpread;
        const spreadY = (Math.random() - 0.5) * randomSpread;

        particle.velocityX = (particle.velocityX + spreadX + dx * 0.002) * dampingFactor;
        particle.velocityY = (particle.velocityY + spreadY + dy * 0.002) * dampingFactor;

        const maxVelocity = MULTIPLIED_VAPORIZE_SPREAD * 2;
        const currentVelocity = Math.sqrt(particle.velocityX * particle.velocityX + particle.velocityY * particle.velocityY);

        if (currentVelocity > maxVelocity) {
          const scale = maxVelocity / currentVelocity;
          particle.velocityX *= scale;
          particle.velocityY *= scale;
        }

        particle.x += particle.velocityX * deltaTime * 20;
        particle.y += particle.velocityY * deltaTime * 10;

        const baseFadeRate = 0.25;
        const durationBasedFadeRate = baseFadeRate * (2000 / VAPORIZE_DURATION);

        particle.opacity = Math.max(0, particle.opacity - deltaTime * durationBasedFadeRate);
      }

      if (particle.opacity > 0.01) {
        allParticlesVaporized = false;
      }
    } else {
      allParticlesVaporized = false;
    }
  });

  return allParticlesVaporized;
};

const renderParticles = (ctx, particles, globalDpr) => {
  ctx.save();
  ctx.scale(globalDpr, globalDpr);

  particles.forEach((particle) => {
    if (particle.opacity > 0) {
      const color = particle.color.replace(/[\d.]+\)$/, `${particle.opacity})`);
      ctx.fillStyle = color;
      ctx.fillRect(particle.x / globalDpr, particle.y / globalDpr, 1, 1);
    }
  });

  ctx.restore();
};

const resetParticles = (particles) => {
  particles.forEach((particle) => {
    particle.x = particle.originalX;
    particle.y = particle.originalY;
    particle.opacity = particle.originalAlpha;
    particle.speed = 0;
    particle.velocityX = 0;
    particle.velocityY = 0;
  });
};

// Interpola o spread do vapor a partir do tamanho da fonte
const calculateVaporizeSpread = (fontSize) => {
  const size = typeof fontSize === 'string' ? parseInt(fontSize) : fontSize;

  const points = [
    { size: 20, spread: 0.2 },
    { size: 50, spread: 0.5 },
    { size: 100, spread: 1.5 },
  ];

  if (size <= points[0].size) return points[0].spread;
  if (size >= points[points.length - 1].size) return points[points.length - 1].spread;

  let i = 0;
  while (i < points.length - 1 && points[i + 1].size < size) i++;

  const p1 = points[i];
  const p2 = points[i + 1];

  return p1.spread + (size - p1.size) * (p2.spread - p1.spread) / (p2.size - p1.size);
};

// Normaliza "rgb(...)"/"rgba(...)" pra rgba válido
const parseColor = (color) => {
  const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  const rgbaMatch = color.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);

  if (rgbaMatch) {
    const [, r, g, b, a] = rgbaMatch;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  } else if (rgbMatch) {
    const [, r, g, b] = rgbMatch;
    return `rgba(${r}, ${g}, ${b}, 1)`;
  }

  console.warn('Could not parse color:', color);
  return 'rgba(0, 0, 0, 1)';
};

// Mapeia um valor de um intervalo pra outro (com clamp opcional)
function transformValue(input, inputRange, outputRange, clamp = false) {
  const [inputMin, inputMax] = inputRange;
  const [outputMin, outputMax] = outputRange;

  const progress = (input - inputMin) / (inputMax - inputMin);
  let result = outputMin + progress * (outputMax - outputMin);

  if (clamp) {
    if (outputMax > outputMin) {
      result = Math.min(Math.max(result, outputMin), outputMax);
    } else {
      result = Math.min(Math.max(result, outputMax), outputMin);
    }
  }

  return result;
}

// Hook: elemento está na viewport?
function useIsInView(ref) {
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    if (!ref.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting);
      },
      { threshold: 0, rootMargin: '50px' }
    );

    observer.observe(ref.current);

    return () => {
      observer.disconnect();
    };
  }, [ref]);

  return isInView;
}
