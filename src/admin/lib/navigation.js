import { LayoutDashboard,Boxes,Gavel,Handshake,ShoppingCart,FileText,UserCheck,Mail,ClipboardCheck,Users,ClipboardList,UserCog,ShieldCheck,ListTree,ChartNoAxesCombined,Activity,PlusSquare } from 'lucide-react';
const STAFF=['admin','manager','team_lead'],MANAGE=['admin','manager'];
export const ADMIN_GROUPS=[
 {label:'WORKSPACE',items:[['/admin','Overview',LayoutDashboard,STAFF],['/admin/inventory','Inventory',Boxes,STAFF],['/admin/add-car','Add vehicle',PlusSquare,MANAGE],['/admin/bids','Live bids',Gavel,STAFF],['/admin/negotiate','Negotiations',Handshake,MANAGE]]},
 {label:'SALES & REQUESTS',items:[['/admin/buy-requests','Purchase requests',ShoppingCart,STAFF],['/admin/auction-requests','Sell requests',FileText,STAFF],['/admin/agent-submissions','Agent submissions',UserCheck,STAFF],['/admin/enquiries','Enquiries',Mail,STAFF],['/admin/c2c-deals','C2C deals',Handshake,STAFF],['/admin/pdi-requests','PDI requests',ClipboardCheck,STAFF]]},
 {label:'PEOPLE & ACCESS',items:[['/admin/dealer-applications','Dealer applications',ClipboardList,MANAGE],['/admin/dealers','Dealer accounts',Users,MANAGE],['/admin/agents','Agents',UserCog,['admin']],['/admin/users','Users & staff',ShieldCheck,['admin']]]},
 {label:'INSIGHTS & SETTINGS',items:[['/admin/reports','Reports',ChartNoAxesCombined,MANAGE],['/admin/activity','Activity log',Activity,STAFF],['/admin/lookups','Dropdown settings',ListTree,MANAGE]]}
];
export const adminPages=role=>ADMIN_GROUPS.flatMap(g=>g.items).filter(item=>item[3].includes(role));
export const roleLabel=role=>({admin:'Administrator',manager:'Manager',team_lead:'Team lead'}[role]||'Staff');
