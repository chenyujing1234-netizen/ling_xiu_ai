import Image from 'next/image';
import HomeBannerTypewriter from './HomeBannerTypewriter';

type Variant = 'today' | 'devotion';

const META: Record<Variant, { src: string; alt: string }> = {
  today: {
    src: '/images/banners/today.png',
    alt: '晨光越过山丘与湖面，开启新的一天',
  },
  devotion: {
    src: '/images/banners/devotion.png',
    alt: '暖光中的灵修旅程：书页与温柔的光',
  },
};

/** 登录后主界面用的长横幅氛围图（今日首页、灵修页） */
export default function PageBanner({
  variant,
  priority = false,
}: {
  variant: Variant;
  priority?: boolean;
}) {
  const { src, alt } = META[variant];
  const typewriter = variant === 'today';

  return (
    <div className="relative -mx-4 mb-5 overflow-hidden rounded-2xl shadow-soft ring-1 ring-line/40">
      <div
        className={`relative w-full ${typewriter ? 'h-[148px] sm:h-[168px]' : 'h-[108px] sm:h-[128px]'}`}
      >
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          sizes="(max-width: 512px) 100vw, 512px"
          className="object-cover object-center"
        />
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/25 via-black/15 to-black/10"
          aria-hidden
        />
        {typewriter ? (
          <>
            <div
              className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.35)_0%,rgba(0,0,0,0.2)_45%,rgba(0,0,0,0.35)_100%)]"
              aria-hidden
            />
            <div className="absolute inset-0 flex items-center justify-center px-5 py-3">
              <HomeBannerTypewriter />
            </div>
          </>
        ) : (
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[rgb(var(--tw-paper)/0.85)] to-transparent"
            aria-hidden
          />
        )}
      </div>
    </div>
  );
}
