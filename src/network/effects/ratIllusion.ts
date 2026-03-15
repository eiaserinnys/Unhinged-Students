// Rat Illusion Effect Mixin for RemotePlayer (Squeak-Squeak Q skill)
// 쥐 환상: 쥐 5마리가 나타남 (진짜 1 + 가짜 4)
// 적이 진짜 쥐를 찾아서 클릭해야 함
// 못 찾으면 초당 체력 10 감소

/**
 * Individual rat object
 */
export interface Rat {
    x: number;
    y: number;
    targetX: number;
    targetY: number;
    isReal: boolean; // 진짜 쥐인지 여부
    angle: number; // 쥐가 바라보는 방향
    wigglePhase: number; // 흔들림 애니메이션 위상
}

/**
 * Interface for objects that can have rat illusion effects applied
 */
export interface RatIllusionEffectState {
    x: number;
    y: number;
    ratIllusionActive: boolean;
    ratIllusionStartTime: number;
    ratIllusionDuration: number;
    rats: Rat[];
    ratIllusionRadius: number;
}

/**
 * Create initial rat positions around the caster
 */
function createRats(centerX: number, centerY: number, radius: number, count: number): Rat[] {
    const rats: Rat[] = [];
    const realRatIndex = Math.floor(Math.random() * count);

    for (let i = 0; i < count; i++) {
        // 랜덤 각도로 퍼지게
        const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
        const distance = radius * (0.5 + Math.random() * 0.5);

        const x = centerX + Math.cos(angle) * distance;
        const y = centerY + Math.sin(angle) * distance;

        // 쥐들이 움직일 목표 위치 (랜덤하게 돌아다님)
        const targetAngle = Math.random() * Math.PI * 2;
        const targetDistance = radius * (0.3 + Math.random() * 0.7);

        rats.push({
            x,
            y,
            targetX: centerX + Math.cos(targetAngle) * targetDistance,
            targetY: centerY + Math.sin(targetAngle) * targetDistance,
            isReal: i === realRatIndex,
            angle: Math.random() * Math.PI * 2,
            wigglePhase: Math.random() * Math.PI * 2,
        });
    }

    return rats;
}

export const RatIllusionEffectMixin = {
    /**
     * Initialize rat illusion effect properties
     */
    initRatIllusionEffect(this: RatIllusionEffectState): void {
        this.ratIllusionActive = false;
        this.ratIllusionStartTime = 0;
        this.ratIllusionDuration = 5000; // 5 seconds
        this.rats = [];
        this.ratIllusionRadius = 200;
    },

    /**
     * Start rat illusion effect
     */
    startRatIllusion(this: RatIllusionEffectState): void {
        this.ratIllusionActive = true;
        this.ratIllusionStartTime = Date.now();
        this.rats = createRats(this.x, this.y, this.ratIllusionRadius, 5);
    },

    /**
     * Update rat illusion effect state
     */
    updateRatIllusion(this: RatIllusionEffectState): void {
        if (!this.ratIllusionActive) return;

        const elapsed = Date.now() - this.ratIllusionStartTime;

        // 시간이 다 되면 효과 종료
        if (elapsed >= this.ratIllusionDuration) {
            this.ratIllusionActive = false;
            this.rats = [];
            return;
        }

        // 쥐들 움직이기
        const speed = 0.02; // 부드럽게 이동
        for (const rat of this.rats) {
            // 목표 위치로 이동
            const dx = rat.targetX - rat.x;
            const dy = rat.targetY - rat.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > 5) {
                rat.x += dx * speed;
                rat.y += dy * speed;
                rat.angle = Math.atan2(dy, dx);
            } else {
                // 새 목표 설정
                const newAngle = Math.random() * Math.PI * 2;
                const newDistance = this.ratIllusionRadius * (0.3 + Math.random() * 0.7);
                rat.targetX = this.x + Math.cos(newAngle) * newDistance;
                rat.targetY = this.y + Math.sin(newAngle) * newDistance;
            }

            // 흔들림 애니메이션
            rat.wigglePhase += 0.3;
        }
    },

    /**
     * Render rat illusion effect
     */
    renderRatIllusion(this: RatIllusionEffectState, ctx: CanvasRenderingContext2D): void {
        if (!this.ratIllusionActive || this.rats.length === 0) return;

        const elapsed = Date.now() - this.ratIllusionStartTime;
        const progress = Math.min(elapsed / this.ratIllusionDuration, 1);

        // 페이드 아웃 효과 (마지막 1초)
        const fadeProgress = progress > 0.8 ? (progress - 0.8) / 0.2 : 0;
        const opacity = 1 - fadeProgress * 0.7;

        ctx.save();
        ctx.globalAlpha = opacity;

        // 각 쥐 그리기
        for (const rat of this.rats) {
            ctx.save();
            ctx.translate(rat.x, rat.y);
            ctx.rotate(rat.angle);

            // 흔들림
            const wiggle = Math.sin(rat.wigglePhase) * 3;
            ctx.translate(0, wiggle);

            // 쥐 몸통 (타원)
            ctx.beginPath();
            ctx.ellipse(0, 0, 25, 15, 0, 0, Math.PI * 2);

            // 진짜 쥐는 살짝 다르게 (하지만 너무 티나면 안됨!)
            if (rat.isReal) {
                // 진짜 쥐: 살짝 더 밝은 핑크
                ctx.fillStyle = '#FFD1DC';
            } else {
                // 가짜 쥐: 반투명 핑크
                ctx.fillStyle = '#FFB6C1';
            }
            ctx.fill();
            ctx.strokeStyle = '#FF69B4';
            ctx.lineWidth = 2;
            ctx.stroke();

            // 쥐 귀 (왼쪽)
            ctx.beginPath();
            ctx.ellipse(-15, -12, 10, 8, -0.3, 0, Math.PI * 2);
            ctx.fillStyle = '#FFC0CB';
            ctx.fill();
            ctx.stroke();

            // 쥐 귀 (오른쪽)
            ctx.beginPath();
            ctx.ellipse(-15, 12, 10, 8, 0.3, 0, Math.PI * 2);
            ctx.fillStyle = '#FFC0CB';
            ctx.fill();
            ctx.stroke();

            // 쥐 눈
            ctx.beginPath();
            ctx.arc(8, -5, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#333';
            ctx.fill();

            ctx.beginPath();
            ctx.arc(8, 5, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#333';
            ctx.fill();

            // 쥐 코
            ctx.beginPath();
            ctx.arc(22, 0, 5, 0, Math.PI * 2);
            ctx.fillStyle = '#FF69B4';
            ctx.fill();

            // 쥐 꼬리
            ctx.beginPath();
            ctx.moveTo(-25, 0);
            ctx.quadraticCurveTo(-40, -15, -50, 0);
            ctx.strokeStyle = '#FFB6C1';
            ctx.lineWidth = 3;
            ctx.stroke();

            // 반짝이 효과 (쥐 주변)
            const sparkleTime = Date.now() / 200;
            for (let i = 0; i < 3; i++) {
                const sparkleAngle = sparkleTime + (i * Math.PI * 2) / 3;
                const sparkleX = Math.cos(sparkleAngle) * 35;
                const sparkleY = Math.sin(sparkleAngle) * 20;
                ctx.fillStyle = `rgba(255, 255, 255, ${0.3 + Math.sin(sparkleTime * 2 + i) * 0.2})`;
                ctx.font = '12px sans-serif';
                ctx.fillText('✨', sparkleX, sparkleY);
            }

            ctx.restore();
        }

        // 남은 시간 표시 (중앙 위)
        const remainingTime = Math.max(0, (this.ratIllusionDuration - elapsed) / 1000);
        ctx.fillStyle = '#FF69B4';
        ctx.font = 'bold 16px Jua, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`🐭 ${remainingTime.toFixed(1)}초`, this.x, this.y - this.ratIllusionRadius - 30);

        ctx.restore();
    },
};

// Backward compatibility: expose to window
declare global {
    interface Window {
        RatIllusionEffectMixin: typeof RatIllusionEffectMixin;
    }
}
window.RatIllusionEffectMixin = RatIllusionEffectMixin;
