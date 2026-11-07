import { Spin } from 'antd';
import styled from 'styled-components';

const Box = styled.div`
  display: flex;
  justify-content: center;
  padding: 80px 0;
`;

export function PageLoading() {
  return (
    <Box>
      <Spin size="large" />
    </Box>
  );
}
