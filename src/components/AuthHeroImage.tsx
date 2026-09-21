import Image from 'next/image';

type Variant = 'login' | 'apply';

const META: Record<Variant, { src: string; alt: string }> = {
  login: {
    src: '/images/auth/login.png',
    alt: '晨光里的安静角落：书与温热的茶',
  },
  apply: {
    src: '/images/auth/apply.png',
    alt: '晨雾中通向欢迎之门的柔和小径',
  },
};

/** 登录 / 申请页顶部的氛围图，与「晨光」品牌一致 */
export default function AuthHeroImage({ variant }: { variant: Variant }) {
  const { src, alt } = META[variant];
  return (
    <div className="relative -mx-7 mb-8 overflow-hidden rounded-b-[28px] shadow-soft">
      <div className="relative aspect-[16/10] w-full max-h-[220px] sm:max-h-[260px]">
        <Image
          src={src}
          alt={alt}
          fill
          priority
          sizes="(max-width: 512px) 100vw, 512px"
          className="object-cover object-center"
        />
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-[rgb(var(--tw-paper))]"
          aria-hidden
        />
      </div>
    </div>
  );
}
