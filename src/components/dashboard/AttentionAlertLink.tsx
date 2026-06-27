import { Link } from 'react-router-dom';

import { ArrowLeft, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

import {

  attentionAlertIconClass,

  attentionAlertItemClass,

} from '@/lib/attentionHighlight';



type AttentionAlertLinkProps = {

  id: string;

  title: string;

  description: string;

  href: string;

  icon: LucideIcon;

};



const AttentionAlertLink = ({

  title,

  description,

  href,

  icon: Icon,

}: AttentionAlertLinkProps) => (

  <Link to={href} className="block group">

    <div

      className={cn(

        'flex items-center gap-3.5 p-4 sm:p-[18px]',

        attentionAlertItemClass

      )}

    >

      <div

        className={cn(

          'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',

          attentionAlertIconClass

        )}

      >

        <Icon className="w-5 h-5" />

      </div>



      <div className="flex-1 min-w-0">

        <div className="flex items-center gap-2 flex-wrap">

          <p className="text-sm font-semibold text-foreground">{title}</p>

          <span className="text-[10px] font-semibold tracking-wide text-destructive/80 bg-destructive/10 px-2 py-0.5 rounded-md border border-destructive/10">

            تنبيه

          </span>

        </div>

        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</p>

      </div>



      <div className="flex items-center gap-1.5 shrink-0 text-muted-foreground group-hover:text-primary transition-colors">

        <span className="text-[11px] font-medium hidden sm:inline">معالجة</span>

        <ArrowLeft className="w-4 h-4" />

      </div>

    </div>

  </Link>

);



export default AttentionAlertLink;


