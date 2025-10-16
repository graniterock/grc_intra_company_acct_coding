export type TicketRow = {
  TicketNo: string;
  BranchNo: string;
  OrderNumber: string;
  ProductCode: string;
  ProductDesc: string;
  TicketDate: string; // ISO yyyy-mm-dd
  UOM: string;
  QTY: number;
  UnitPrice: number;
  AcctCode: string;
};

export type OrderRow = {
  OrderNumber: string;
  ProductCode: string;
  ProductDesc: string;
  StartDate: string; // ISO yyyy-mm-dd
  EndDate: string; // ISO yyyy-mm-dd
  OrderAcctCode: string;
  FreightCodeByTon_AA: string; // AA
  ERF_AcctCode: string;
  MTX_AcctCode: string;
  AcctCode: string;
  PW_AcctCode: string;
  LAS_AcctCode: string;
  FS_AcctCode: string;
};
