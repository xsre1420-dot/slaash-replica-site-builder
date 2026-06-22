import { useEffect } from 'react';

/** Prevent admin URLs from being indexed; restore on unmount. */
export const AdminPrivateMeta = ({ title = 'لوحة المبيعات' }: { title?: string }) => {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = `${title} | بداية`;

    let robots = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    const created = !robots;
    if (!robots) {
      robots = document.createElement('meta');
      robots.name = 'robots';
      document.head.appendChild(robots);
    }
    const prevRobots = robots.content;
    robots.content = 'noindex, nofollow';

    return () => {
      document.title = prevTitle;
      if (created && robots?.parentNode) {
        robots.parentNode.removeChild(robots);
      } else if (robots) {
        robots.content = prevRobots;
      }
    };
  }, [title]);

  return null;
};

export default AdminPrivateMeta;
