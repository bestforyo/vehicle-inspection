ALTER TABLE "User" ADD COLUMN "wechatOpenidHash" TEXT;
CREATE UNIQUE INDEX "User_wechatOpenidHash_key" ON "User"("wechatOpenidHash");
