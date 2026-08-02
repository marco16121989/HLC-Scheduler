export const SHAREPOINT_URL = "https://login.microsoftonline.com/e9b2b7ba-b238-42a9-b271-2adfc82da650/oauth2/authorize?client%5Fid=00000003%2D0000%2D0ff1%2Dce00%2D000000000000&response%5Fmode=form%5Fpost&ear%5Fjwe%5Fcrypto=eyJhbGciOiJFQ0RILUVTIiwiZW5jIjoiQTI1NkdDTSIsImFwdiI6IkFBQUFDVVZoY2tOc2FXVnVkR2dBQUFCRlEwc3pNQUFBQUFoZFk0UWF0L1dMT0hFaXFaQnFSYmNJSDJhbitmYXJRTTZQSFJGTnk2MVV5Z0g0cjBhTGc2TnFmQkNyQW5GZnl4bUJQVTg5bFZ2QnptYmpETXBQT1A4UzRFRkxWTElmT25XcFFXWVRORlRjVUhiR3ZEeU5rQklFMlArV0l5R2E0Z0FBQUJqVG9DMTYwdW1pbzNNMlBJakQrQ0xUVEFPbkhydmtjbzg9In0%3D&ear%5Fjwk=eyJhbGciOiJFQ0RILUVTIiwiY3J2IjoiUC0zODQiLCJ4IjoiQUFBQU1BaGRZNFFhdC9XTE9IRWlxWkJxUmJjSUgyYW4rZmFyUU02UEhSRk55NjFVeWdINHIwYUxnNk5xZkJDckFuRmZ5dz09IiwieSI6IkFBQUFNQm1CUFU4OWxWdkJ6bWJqRE1wUE9QOFM0RUZMVkxJZk9uV3BRV1lUTkZUY1VIYkd2RHlOa0JJRTJQK1dJeUdhNGc9PSIsImt0eSI6IkVDIn0%3D&spa%5Fclient%5Fid=08e18876%2D6177%2D487e%2Db8b5%2Dcf950c1e598c&client%5Finfo=1&response%5Ftype=code%20id%5Ftoken%20spa%5Frt&resource=00000003%2D0000%2D0ff1%2Dce00%2D000000000000&scope=openid&nonce=E72539A65E8854E4265D278B380A4F29ADDEB0BFF06EEE42%2D50E24C51896EE3EEC3D3FA38CCA01587A7DF5572220B4B71AD3C13C0C265F7BE&redirect%5Furi=https%3A%2F%2Fjwsite%2Esharepoint%2Ecom%2F%5Fforms%2Fdefault%2Easpx&state=OD0wJjMyPUFBTVRJUUFBQUJRNzI4MlFkU1lLamZBU0pYSiUyRmI4aVo4VzV2aHJwMWlVVm1qc1JBdGd2Y3VLNDFvazZWcHpObzZ2Tkd6aUFIRDJBUHFKNlZSJTJCYUxxc2lBampJUlYlMkZaRTIlMkZ4U2JBMmpVWXZHQzVOcDZhb3ZVRkFWdG1KdTdrUzNHcnh4Q2t0WFBtNFJqclk3T04zd1VINEM1VERZZzA1YmFHSUNFTHcxam5MRUVKJTJGV3JyeDBVaVJhY0IwV2l2QnZraEc5bTk0anhjNDdzTHdpOGJjajdodDUwQzFac0RmaFNCVGZsVllEZjZvd1BXQkNQcloxNWpHbERqZ0xpenZHa3lzRDlRc1JCdWs2WTRqRDh2S1JlSDY4Qmt6cjN4WjdtOEpFMFlVVWJScVN1cHoyYU9ac21pamxlVE9IQURiZnljZiUyQjdGa3NjQjdUc2VzJTJCOFAlMkI0ZWgzQ2JRZVQ1eE92MFp2c2JpY2RmYkVXYVczTTVrSXFXcnY5T05ab2NmJTJCaHh3JTNEJTNE&claims=%7B%22id%5Ftoken%22%3A%7B%22xms%5Fcc%22%3A%7B%22values%22%3A%5B%22CP1%22%5D%7D%7D%7D&wsucxt=1&cobrandid=11bd8083%2D87e0%2D41b5%2Dbb78%2D0bc43c8a8e8a&client%2Drequest%2Did=fc452da2%2D80ab%2D2000%2D061f%2Dab2cac41bca7&sso_reload=true";

export const SharePoint = () => (
  <>
    <div className="app-content-header">
      <div className="container-fluid d-flex align-items-center justify-content-between gap-3">
        <h1 className="mb-0">Share Point</h1>
        <a className="btn btn-outline-primary" href={SHAREPOINT_URL} target="_blank" rel="noreferrer">
          Apri in una nuova scheda
        </a>
      </div>
    </div>
    <div className="app-content sharepoint-content">
      <div className="container-fluid h-100">
        <section className="card sharepoint-card">
          <iframe
            className="sharepoint-frame"
            src={SHAREPOINT_URL}
            title="Share Point"
            referrerPolicy="strict-origin-when-cross-origin"
            allow="clipboard-read; clipboard-write"
          />
        </section>
      </div>
    </div>
  </>
);
